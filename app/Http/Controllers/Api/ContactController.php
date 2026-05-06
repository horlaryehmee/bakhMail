<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Contact;
use App\Models\ContactGroup;
use App\Models\Tag;
use App\Services\ActivityLogger;
use App\Services\ContactImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ContactController extends Controller
{
    public function __construct(
        private readonly ContactImportService $importService,
        private readonly ActivityLogger $activityLogger,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $contacts = $request->user()->contacts()
            ->with(['tags', 'groups'])
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

    public function destroy(Request $request, Contact $contact): JsonResponse
    {
        abort_unless($contact->user_id === $request->user()->id, 404);
        $email = $contact->email;
        $contact->delete();

        $this->activityLogger->log($request->user(), 'contacts.deleted', Contact::class, $request, ['email' => $email], "Deleted contact {$email}.");

        return response()->json(['status' => 'deleted']);
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
        ];

        if ($withActivity) {
            $payload['email_logs'] = $contact->emailLogs->map(fn ($log) => [
                'id' => $log->id,
                'direction' => $log->direction,
                'event_type' => $log->event_type,
                'subject' => $log->subject,
                'body_preview' => $log->body_preview,
                'sent_at' => $log->sent_at?->toIso8601String(),
            ])->all();
        }

        return $payload;
    }
}
