<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ConversationThread;
use App\Models\Contact;
use App\Models\ContactGroup;
use App\Models\EmailAccount;
use App\Models\EmailLog;
use App\Models\SuppressionEntry;
use App\Models\Tag;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\ContactImportService;
use App\Services\DynamicSmtpMailer;
use App\Services\TrackingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class ContactController extends Controller
{
    public function __construct(
        private readonly ContactImportService $importService,
        private readonly ActivityLogger $activityLogger,
        private readonly DynamicSmtpMailer $dynamicSmtpMailer,
        private readonly TrackingService $trackingService,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $contacts = $request->user()->contacts()
            ->with(['tags', 'groups', 'latestEmailLog'])
            ->when($request->string('search')->toString(), function ($query, string $search): void {
                $query->where(function ($searchQuery) use ($search): void {
                    $searchQuery
                        ->where('email', 'like', '%'.$search.'%')
                        ->orWhere('first_name', 'like', '%'.$search.'%')
                        ->orWhere('last_name', 'like', '%'.$search.'%')
                        ->orWhere('company', 'like', '%'.$search.'%');
                });
            })
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')))
            ->when($request->filled('tag_id'), fn ($query) => $query->whereHas('tags', fn ($tagQuery) => $tagQuery->where('tags.id', $request->integer('tag_id'))))
            ->when($request->filled('group_id'), fn ($query) => $query->whereHas('groups', fn ($groupQuery) => $groupQuery->where('contact_groups.id', $request->integer('group_id'))))
            ->latest()
            ->paginate(25);

        return response()->json([
            'data' => collect($contacts->items())->map(fn (Contact $contact) => $this->serializeContact($contact))->all(),
            'meta' => [
                'current_page' => $contacts->currentPage(),
                'last_page' => $contacts->lastPage(),
                'total' => $contacts->total(),
            ],
            'filters' => [
                'tags' => Tag::query()->where('user_id', $request->user()->id)->orderBy('name')->get(['id', 'name', 'color']),
                'groups' => ContactGroup::query()->where('user_id', $request->user()->id)->orderBy('name')->get(['id', 'name', 'color']),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $this->validatePayload($request);

        $contact = $request->user()->contacts()->create($validated);
        $this->syncTaxonomy($request, $contact);
        $contact->load(['tags', 'groups']);

        $this->activityLogger->log($request->user(), 'contacts.created', $contact, $request, description: "Created contact {$contact->email}.");

        return response()->json(['data' => $this->serializeContact($contact)], 201);
    }

    public function show(Request $request, Contact $contact): JsonResponse
    {
        abort_unless($contact->user_id === $request->user()->id, 404);
        $contact->load(['tags', 'groups', 'emailLogs' => fn ($query) => $query->latest()->limit(20)]);

        return response()->json([
            'data' => $this->serializeContact($contact, true),
        ]);
    }

    public function update(Request $request, Contact $contact): JsonResponse
    {
        abort_unless($contact->user_id === $request->user()->id, 404);
        $validated = $this->validatePayload($request, $contact->id);

        $contact->update($validated);
        $this->syncTaxonomy($request, $contact);
        $contact->load(['tags', 'groups']);

        $this->activityLogger->log($request->user(), 'contacts.updated', $contact, $request, description: "Updated contact {$contact->email}.");

        return response()->json(['data' => $this->serializeContact($contact)]);
    }

    public function save(Request $request, int $contact): JsonResponse
    {
        $ownedContact = $this->resolveOwnedContact($request->user(), $contact);
        $validated = $this->validatePayload($request, $ownedContact->id);

        DB::table('contacts')
            ->where('id', $ownedContact->id)
            ->where('user_id', $request->user()->id)
            ->update([
                'first_name' => $validated['first_name'] ?? null,
                'last_name' => $validated['last_name'] ?? null,
                'email' => strtolower($validated['email']),
                'company' => $validated['company'] ?? null,
                'job_title' => $validated['job_title'] ?? null,
                'phone' => $validated['phone'] ?? null,
                'website' => $validated['website'] ?? null,
                'location' => $validated['location'] ?? null,
                'notes' => $validated['notes'] ?? null,
                'status' => $validated['status'] ?? 'active',
                'custom_fields' => isset($validated['custom_fields']) ? json_encode($validated['custom_fields']) : null,
                'updated_at' => now(),
            ]);

        $ownedContact = $this->resolveOwnedContact($request->user(), $contact);
        $this->syncTaxonomy($request, $ownedContact);
        $ownedContact->load(['tags', 'groups']);

        $this->activityLogger->log($request->user(), 'contacts.updated', $ownedContact, $request, description: "Updated contact {$ownedContact->email}.");

        return response()->json(['data' => $this->serializeContact($ownedContact)]);
    }

    public function destroy(Request $request, Contact $contact): JsonResponse
    {
        abort_unless($contact->user_id === $request->user()->id, 404);
        return $this->deleteOwnedContact($request, $contact);
    }

    public function remove(Request $request, int $contact): JsonResponse
    {
        $ownedContact = $this->resolveOwnedContact($request->user(), $contact);

        return $this->deleteOwnedContact($request, $ownedContact);
    }

    public function clear(Request $request): JsonResponse
    {
        $deleted = 0;

        DB::transaction(function () use ($request, &$deleted): void {
            $contacts = Contact::query()
                ->where('user_id', $request->user()->id)
                ->get(['id', 'email']);

            foreach ($contacts as $contact) {
                $this->deleteOwnedContact($request, $contact, logActivity: false);
                $deleted++;
            }
        });

        $this->activityLogger->log(
            $request->user(),
            'contacts.cleared',
            Contact::class,
            $request,
            ['deleted_count' => $deleted],
            "Cleared {$deleted} contacts."
        );

        return response()->json([
            'status' => 'cleared',
            'deleted_count' => $deleted,
        ]);
    }

    public function import(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt'],
        ]);

        $result = $this->importService->import($request->user(), $request->file('file'));
        $this->activityLogger->log($request->user(), 'contacts.imported', Contact::class, $request, $result, 'Imported contacts from CSV.');

        return response()->json($result);
    }

    public function export(Request $request): StreamedResponse
    {
        $contacts = $request->user()->contacts()->with(['tags', 'groups'])->get();

        return response()->streamDownload(function () use ($contacts): void {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['first_name', 'last_name', 'email', 'company', 'job_title', 'status', 'tags', 'groups']);

            foreach ($contacts as $contact) {
                fputcsv($handle, [
                    $contact->first_name,
                    $contact->last_name,
                    $contact->email,
                    $contact->company,
                    $contact->job_title,
                    $contact->status,
                    $contact->tags->pluck('name')->implode('|'),
                    $contact->groups->pluck('name')->implode('|'),
                ]);
            }

            fclose($handle);
        }, 'contacts.csv', ['Content-Type' => 'text/csv']);
    }

    public function importTemplate(): StreamedResponse
    {
        return response()->streamDownload(function (): void {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['first_name', 'last_name', 'email', 'company', 'job_title', 'phone', 'website', 'location', 'notes', 'status', 'tags', 'groups']);
            fputcsv($handle, ['Ada', 'Okafor', 'ada@example.com', 'Acme Labs', 'Growth Lead', '+2348000000000', 'https://acme.example', 'Lagos', 'Met at SaaS meetup', 'active', 'ICP A|warm', 'Q2 prospects|Nigeria']);
            fputcsv($handle, ['Musa', 'Bello', 'musa@example.com', 'Northwind', 'Founder', '', 'https://northwind.example', 'Abuja', '', 'inactive', 'founder', 'Trial list']);
            fclose($handle);
        }, 'contacts-import-sample.csv', ['Content-Type' => 'text/csv']);
    }

    public function quickSend(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'first_name' => ['nullable', 'string', 'max:255'],
            'last_name' => ['nullable', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'company' => ['nullable', 'string', 'max:255'],
            'job_title' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:255'],
            'website' => ['nullable', 'string', 'max:255'],
            'location' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
            'status' => ['nullable', 'string', 'max:40'],
            'email_account_id' => ['required', 'integer'],
            'subject' => ['required', 'string', 'max:255'],
            'body_html' => ['required', 'string', 'min:10'],
            'body_text' => ['nullable', 'string'],
        ]);

        $account = $request->user()->emailAccounts()->find($validated['email_account_id']);

        if (! $account instanceof EmailAccount) {
            throw ValidationException::withMessages([
                'email_account_id' => 'Choose a valid sender mailbox before sending.',
            ]);
        }

        if (SuppressionEntry::query()
            ->where('user_id', $request->user()->id)
            ->where('email', strtolower($validated['email']))
            ->exists()) {
            throw ValidationException::withMessages([
                'email' => 'This contact is currently suppressed and cannot receive outreach.',
            ]);
        }

        $existingContact = Contact::query()
            ->where('user_id', $request->user()->id)
            ->where('email', strtolower($validated['email']))
            ->first();

        if ($existingContact && in_array($existingContact->status, ['unsubscribed', 'bounced'], true)) {
            throw ValidationException::withMessages([
                'email' => 'This contact cannot receive cold email because they are unsubscribed or bounced.',
            ]);
        }

        $htmlBody = trim((string) $validated['body_html']);
        $text = trim((string) ($validated['body_text'] ?? strip_tags($htmlBody)));
        $headers = [];

        if ($existingContact) {
            $lastMessageId = EmailLog::query()
                ->where('contact_id', $existingContact->id)
                ->where('email_account_id', $account->id)
                ->whereNotNull('provider_message_id')
                ->latest('id')
                ->value('provider_message_id');

            if ($lastMessageId) {
                $headers['In-Reply-To'] = $lastMessageId;
                $headers['References'] = $lastMessageId;
            }
        }

        try {
            $sendResult = $this->dynamicSmtpMailer->send($account, [
                'to' => strtolower($validated['email']),
                'subject' => $validated['subject'],
                'html' => $htmlBody,
                'text' => $text,
                'headers' => $headers,
            ]);
        } catch (RuntimeException $exception) {
            throw ValidationException::withMessages([
                'email_account_id' => $exception->getMessage(),
            ]);
        }

        $result = [
            'contact' => null,
            'thread' => null,
            'log' => null,
        ];

        try {
            $result = DB::transaction(function () use ($request, $validated, $account, $text, $sendResult): array {
                $contact = Contact::firstOrNew([
                    'user_id' => $request->user()->id,
                    'email' => strtolower($validated['email']),
                ]);

                if (! $contact->unsubscribe_token) {
                    $contact->unsubscribe_token = (string) Str::uuid();
                }

                $contact->fill([
                    'first_name' => $validated['first_name'] ?? $contact->first_name,
                    'last_name' => $validated['last_name'] ?? $contact->last_name,
                    'company' => $validated['company'] ?? $contact->company,
                    'job_title' => $validated['job_title'] ?? $contact->job_title,
                    'phone' => $validated['phone'] ?? $contact->phone,
                    'website' => $validated['website'] ?? $contact->website,
                    'location' => $validated['location'] ?? $contact->location,
                    'notes' => $validated['notes'] ?? $contact->notes,
                    'status' => $validated['status'] ?? $contact->status ?? 'active',
                    'last_contacted_at' => now(),
                ]);
                $contact->save();

                $thread = ConversationThread::firstOrCreate(
                    [
                        'user_id' => $request->user()->id,
                        'contact_id' => $contact->id,
                        'campaign_id' => null,
                    ],
                    [
                        'email_account_id' => $account->id,
                        'subject' => $validated['subject'],
                        'status' => 'open',
                        'last_message_at' => now(),
                    ],
                );

                $log = EmailLog::create([
                    'user_id' => $request->user()->id,
                    'campaign_id' => null,
                    'campaign_step_id' => null,
                    'campaign_recipient_id' => null,
                    'contact_id' => $contact->id,
                    'email_account_id' => $account->id,
                    'conversation_thread_id' => $thread->id,
                    'direction' => 'outbound',
                    'event_type' => 'sent',
                    'subject' => $validated['subject'],
                    'recipient_email' => $contact->email,
                    'sender_email' => $account->email_address,
                    'tracking_token' => (string) Str::uuid(),
                    'unsubscribe_token' => $contact->unsubscribe_token,
                    'provider_message_id' => trim($sendResult['message_id'] ?? '', '<>'),
                    'body_preview' => mb_substr($text, 0, 240),
                    'sent_at' => now(),
                    'metadata' => [
                        'body_html' => trim((string) $validated['body_html']),
                        'body_text' => $text,
                    ],
                ]);

                $thread->update([
                    'email_account_id' => $account->id,
                    'subject' => $validated['subject'],
                    'last_message_at' => now(),
                    'status' => 'open',
                ]);

                $this->activityLogger->log(
                    $request->user(),
                    'contacts.quick_email_sent',
                    $contact,
                    $request,
                    [
                        'email_account_id' => $account->id,
                        'thread_id' => $thread->id,
                        'email_log_id' => $log->id,
                    ],
                    "Sent a quick cold email to {$contact->email}."
                );

                $contact->load(['tags', 'groups', 'latestEmailLog']);

                return [
                    'contact' => $contact,
                    'thread' => $thread,
                    'log' => $log->fresh(),
                ];
            });
        } catch (Throwable $exception) {
            Log::warning('Quick mail was sent but activity could not be persisted.', [
                'email_address' => strtolower($validated['email']),
                'email_account_id' => $account->id,
                'message_id' => $sendResult['message_id'] ?? null,
                'error' => $exception->getMessage(),
            ]);
        }

        return response()->json([
            'data' => [
                'status' => 'sent',
                'message_id' => trim($sendResult['message_id'] ?? '', '<>'),
                'contact' => $result['contact'] ? $this->serializeContact($result['contact']) : null,
                'thread_id' => $result['thread']?->id,
                'email_log' => $result['log'] ? $this->serializeEmailLog($result['log']) : null,
            ],
        ], 201);
    }

    private function validatePayload(Request $request, ?int $ignoreId = null): array
    {
        return $request->validate([
            'first_name' => ['nullable', 'string', 'max:255'],
            'last_name' => ['nullable', 'string', 'max:255'],
            'email' => [
                'required',
                'email',
                'max:255',
                Rule::unique('contacts', 'email')
                    ->ignore($ignoreId)
                    ->where(fn ($query) => $query->where('user_id', $request->user()->id)),
            ],
            'company' => ['nullable', 'string', 'max:255'],
            'job_title' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:255'],
            'website' => ['nullable', 'string', 'max:255'],
            'location' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'],
            'status' => ['nullable', 'string', 'max:40'],
            'custom_fields' => ['nullable', 'array'],
        ]);
    }

    private function syncTaxonomy(Request $request, Contact $contact): void
    {
        $tagIds = collect($request->input('tags', []))
            ->map(function ($tag) use ($request) {
                if (is_array($tag) && isset($tag['id'])) {
                    return (int) $tag['id'];
                }

                if (is_string($tag) && trim($tag) !== '') {
                    return Tag::firstOrCreate(
                        ['user_id' => $request->user()->id, 'name' => trim($tag)],
                        ['color' => '#14b8a6'],
                    )->id;
                }

                return null;
            })
            ->filter()
            ->all();

        $groupIds = collect($request->input('groups', []))
            ->map(function ($group) use ($request) {
                if (is_array($group) && isset($group['id'])) {
                    return (int) $group['id'];
                }

                if (is_string($group) && trim($group) !== '') {
                    return ContactGroup::firstOrCreate(
                        ['user_id' => $request->user()->id, 'name' => trim($group)],
                        ['color' => '#60a5fa'],
                    )->id;
                }

                return null;
            })
            ->filter()
            ->all();

        $contact->tags()->sync($tagIds);
        $contact->groups()->sync($groupIds);
    }

    private function serializeContact(Contact $contact, bool $withActivity = false): array
    {
        $payload = [
            'id' => $contact->id,
            'first_name' => $contact->first_name,
            'last_name' => $contact->last_name,
            'full_name' => $contact->full_name,
            'email' => $contact->email,
            'company' => $contact->company,
            'job_title' => $contact->job_title,
            'phone' => $contact->phone,
            'website' => $contact->website,
            'location' => $contact->location,
            'notes' => $contact->notes,
            'status' => $contact->status,
            'custom_fields' => $contact->custom_fields ?? [],
            'last_contacted_at' => $contact->last_contacted_at?->toIso8601String(),
            'replied_at' => $contact->replied_at?->toIso8601String(),
            'bounced_at' => $contact->bounced_at?->toIso8601String(),
            'unsubscribed_at' => $contact->unsubscribed_at?->toIso8601String(),
            'tags' => $contact->tags->map(fn (Tag $tag) => ['id' => $tag->id, 'name' => $tag->name, 'color' => $tag->color])->all(),
            'groups' => $contact->groups->map(fn (ContactGroup $group) => ['id' => $group->id, 'name' => $group->name, 'color' => $group->color])->all(),
            'latest_email_log' => $contact->relationLoaded('latestEmailLog') && $contact->latestEmailLog
                ? $this->serializeEmailLog($contact->latestEmailLog)
                : null,
        ];

        if ($withActivity) {
            $payload['email_logs'] = $contact->emailLogs->map(fn ($log) => $this->serializeEmailLog($log))->all();
        }

        return $payload;
    }

    private function serializeEmailLog(EmailLog $log): array
    {
        return [
            'id' => $log->id,
            'conversation_thread_id' => $log->conversation_thread_id,
            'direction' => $log->direction,
            'event_type' => $log->event_type,
            'subject' => $log->subject,
            'body_preview' => $log->body_preview,
            'sender_email' => $log->sender_email,
            'recipient_email' => $log->recipient_email,
            'provider_message_id' => $log->provider_message_id,
            'in_reply_to' => $log->in_reply_to,
            'body_text' => $log->metadata['body_text'] ?? null,
            'sent_at' => $log->sent_at?->toIso8601String(),
            'opened_at' => $log->opened_at?->toIso8601String(),
            'clicked_at' => $log->clicked_at?->toIso8601String(),
        ];
    }

    private function resolveOwnedContact(User $user, int $contactId): Contact
    {
        return Contact::query()
            ->where('user_id', $user->id)
            ->findOrFail($contactId);
    }

    private function deleteOwnedContact(Request $request, Contact $contact, bool $logActivity = true): JsonResponse
    {
        $email = $contact->email;

        DB::transaction(function () use ($contact): void {
            DB::table('tracking_events')->where('contact_id', $contact->id)->delete();
            DB::table('contact_tag')->where('contact_id', $contact->id)->delete();
            DB::table('contact_group_members')->where('contact_id', $contact->id)->delete();
            DB::table('campaign_recipients')->where('contact_id', $contact->id)->delete();
            DB::table('email_logs')->where('contact_id', $contact->id)->update([
                'contact_id' => null,
                'conversation_thread_id' => null,
                'updated_at' => now(),
            ]);
            DB::table('conversation_threads')->where('contact_id', $contact->id)->delete();
            DB::table('suppression_entries')->where('user_id', $contact->user_id)->where('email', $contact->email)->delete();
            DB::table('contacts')->where('id', $contact->id)->delete();
        });

        if ($logActivity) {
            $this->activityLogger->log($request->user(), 'contacts.deleted', Contact::class, $request, ['email' => $email], "Deleted contact {$email}.");
        }

        return response()->json(['status' => 'deleted']);
    }

}
