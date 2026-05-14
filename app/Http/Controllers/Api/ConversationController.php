<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ConversationThread;
use App\Models\EmailLog;
use App\Services\ActivityLogger;
use App\Services\DynamicSmtpMailer;
use App\Services\ReplySyncService;
use App\Services\TrackingService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class ConversationController extends Controller
{
    public function __construct(
        private readonly DynamicSmtpMailer $dynamicSmtpMailer,
        private readonly TrackingService $trackingService,
        private readonly ActivityLogger $activityLogger,
        private readonly ReplySyncService $replySyncService,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        if ($request->boolean('sync')) {
            $this->replySyncService->syncUser($request->user());
        }

        $folder = $request->string('folder', 'all')->toString();
        $search = trim($request->string('search')->toString());
        $accountId = $request->string('account_id', 'all')->toString();
        $perPage = min(max($request->integer('per_page', 50), 20), 100);
        $baseQuery = ConversationThread::query()
            ->where('user_id', $request->user()->id);

        $query = (clone $baseQuery)
            ->with([
                'contact',
                'campaign',
                'emailAccount',
                'latestEmailLog',
                'latestInboundEmailLog',
            ])
            ->withCount([
                'emailLogs as message_count',
                'emailLogs as inbound_count' => fn (Builder $query) => $query->where('direction', 'inbound'),
                'emailLogs as outbound_count' => fn (Builder $query) => $query->where('direction', 'outbound'),
            ]);

        $this->applyAccountFilter($query, $accountId);
        $this->applyFolderFilter($query, $folder);
        $this->applySearchFilter($query, $search);

        $threads = $query
            ->orderByDesc('last_message_at')
            ->orderByDesc('id')
            ->paginate($perPage)
            ->withQueryString();

        return response()->json([
            'data' => collect($threads->items())->map(fn (ConversationThread $thread) => $this->serializeThread($thread, false))->all(),
            'meta' => [
                'current_page' => $threads->currentPage(),
                'last_page' => $threads->lastPage(),
                'per_page' => $threads->perPage(),
                'total' => $threads->total(),
                'from' => $threads->firstItem(),
                'to' => $threads->lastItem(),
            ],
            'stats' => $this->mailboxStats((clone $baseQuery)),
            'accounts' => $request->user()->emailAccounts()
                ->select(['id', 'name', 'email_address'])
                ->withCount(['conversationThreads as threads_count'])
                ->orderBy('email_address')
                ->get()
                ->map(fn ($account) => [
                    'id' => $account->id,
                    'name' => $account->name,
                    'email_address' => $account->email_address,
                    'threads_count' => $account->threads_count,
                ])
                ->all(),
        ]);
    }

    public function show(Request $request, ConversationThread $thread): JsonResponse
    {
        abort_unless($thread->user_id === $request->user()->id, 404);
        $thread->load([
            'contact',
            'campaign',
            'emailAccount',
            'latestEmailLog',
            'latestInboundEmailLog',
            'emailLogs' => fn ($query) => $query->oldest('sent_at')->oldest('id')->limit(50),
        ]);
        $thread->loadCount([
            'emailLogs as message_count',
            'emailLogs as inbound_count' => fn (Builder $query) => $query->where('direction', 'inbound'),
            'emailLogs as outbound_count' => fn (Builder $query) => $query->where('direction', 'outbound'),
        ]);

        return response()->json([
            'data' => $this->serializeThread($thread),
        ]);
    }

    public function sync(Request $request): JsonResponse
    {
        try {
            $count = $this->replySyncService->syncUser($request->user());
        } catch (Throwable $exception) {
            report($exception);

            $message = trim($exception->getMessage()) ?: 'Mailbox sync failed. Check IMAP settings and try again.';

            return response()->json([
                'message' => $message,
                'errors' => [
                    'sync' => [$message],
                ],
            ], 422);
        }

        return response()->json([
            'status' => 'synced',
            'count' => $count,
        ]);
    }

    public function reply(Request $request, ConversationThread $thread): JsonResponse
    {
        abort_unless($thread->user_id === $request->user()->id, 404);
        $thread->load(['contact', 'emailAccount', 'campaign']);

        if (! $thread->contact) {
            throw ValidationException::withMessages([
                'thread' => 'This conversation does not have a contact attached.',
            ]);
        }

        if (! $thread->emailAccount) {
            throw ValidationException::withMessages([
                'thread' => 'This conversation does not have a sender mailbox attached.',
            ]);
        }

        $validated = $request->validate([
            'subject' => ['nullable', 'string', 'max:255'],
            'body_html' => ['required', 'string', 'min:2'],
            'body_text' => ['nullable', 'string'],
        ]);

        $subject = trim((string) ($validated['subject'] ?? $thread->subject ?: 'Re: Conversation'));
        $htmlBody = trim((string) $validated['body_html']);
        $textBody = trim((string) ($validated['body_text'] ?? strip_tags($htmlBody)));

        $log = null;

        try {
            $log = EmailLog::create([
                'user_id' => $request->user()->id,
                'campaign_id' => $thread->campaign_id,
                'campaign_step_id' => null,
                'campaign_recipient_id' => null,
                'contact_id' => $thread->contact_id,
                'email_account_id' => $thread->email_account_id,
                'conversation_thread_id' => $thread->id,
                'direction' => 'outbound',
                'event_type' => 'queued',
                'subject' => $subject,
                'recipient_email' => $thread->contact->email,
                'sender_email' => $thread->emailAccount->email_address,
                'tracking_token' => (string) Str::uuid(),
                'unsubscribe_token' => $thread->contact->unsubscribe_token,
                'metadata' => [
                    'body_html' => $htmlBody,
                    'body_text' => $textBody,
                ],
            ]);

            $lastMessageId = $thread->emailLogs()
                ->whereNotNull('provider_message_id')
                ->latest('id')
                ->value('provider_message_id');

            $headers = [];

            if ($lastMessageId) {
                $headers['In-Reply-To'] = $lastMessageId;
                $headers['References'] = $lastMessageId;
            }

            $html = $this->trackingService->decorate($log, $htmlBody, [
                'include_footer' => false,
            ]);

            $result = $this->dynamicSmtpMailer->send($thread->emailAccount, [
                'to' => $thread->contact->email,
                'subject' => $subject,
                'html' => $html,
                'text' => $textBody,
                'headers' => $headers,
            ]);

            $log->update([
                'event_type' => 'sent',
                'provider_message_id' => trim($result['message_id'] ?? '', '<>'),
                'body_preview' => mb_substr($textBody, 0, 240),
                'sent_at' => now(),
            ]);

            $thread->update([
                'subject' => $subject,
                'status' => 'open',
                'last_message_at' => now(),
            ]);

            $thread->contact->update([
                'last_contacted_at' => now(),
            ]);
        } catch (Throwable $exception) {
            report($exception);

            $message = $this->replyFailureMessage($exception);

            if ($log) {
                $metadata = $log->metadata ?? [];
                $metadata['send_error'] = $message;

                $log->update([
                    'event_type' => 'failed',
                    'body_preview' => mb_substr($textBody, 0, 240),
                    'metadata' => $metadata,
                ]);
            }

            return response()->json([
                'message' => $message,
                'errors' => [
                    'reply' => [$message],
                ],
            ], 422);
        }

        if (! $log) {
            $message = 'Reply could not be queued. Try again after refreshing the mailbox.';

            return response()->json([
                'message' => $message,
                'errors' => [
                    'reply' => [$message],
                ],
            ], 422);
        }

        $this->activityLogger->log(
            $request->user(),
            'conversations.replied',
            $thread,
            $request,
            ['email_log_id' => $log->id],
            "Replied to {$thread->contact->email} from the conversation thread."
        );

        return $this->show($request, $thread->fresh());
    }

    private function applyAccountFilter(Builder $query, string $accountId): void
    {
        if ($accountId !== '' && $accountId !== 'all') {
            $query->where('email_account_id', $accountId);
        }
    }

    private function applyFolderFilter(Builder $query, string $folder): void
    {
        if ($folder === 'inbox') {
            $query->whereHas('latestEmailLog', fn (Builder $logQuery) => $logQuery->where('direction', 'inbound'));

            return;
        }

        if ($folder === 'sent') {
            $query->whereHas('latestEmailLog', fn (Builder $logQuery) => $logQuery->where('direction', 'outbound'));

            return;
        }

        if ($folder === 'needs_reply') {
            $query
                ->whereHas('latestEmailLog', fn (Builder $logQuery) => $logQuery->where('direction', 'inbound'))
                ->whereHas('latestInboundEmailLog')
                ->where(fn (Builder $threadQuery) => $threadQuery->whereNull('status')->orWhere('status', '!=', 'attention'))
                ->whereDoesntHave('emailLogs', fn (Builder $logQuery) => $logQuery->where('event_type', 'bounced'));

            return;
        }

        if ($folder === 'replied') {
            $query
                ->whereHas('latestEmailLog', fn (Builder $logQuery) => $logQuery->where('direction', 'outbound'))
                ->whereHas('latestInboundEmailLog')
                ->where(fn (Builder $threadQuery) => $threadQuery->whereNull('status')->orWhere('status', '!=', 'attention'))
                ->whereDoesntHave('emailLogs', fn (Builder $logQuery) => $logQuery->where('event_type', 'bounced'));

            return;
        }

        if ($folder === 'bounced') {
            $query->where(fn (Builder $threadQuery) => $threadQuery
                ->where('status', 'attention')
                ->orWhereHas('emailLogs', fn (Builder $logQuery) => $logQuery->where('event_type', 'bounced')));
        }
    }

    private function applySearchFilter(Builder $query, string $search): void
    {
        if ($search === '') {
            return;
        }

        $query->where(function (Builder $searchQuery) use ($search): void {
            $searchQuery
                ->where('subject', 'like', '%'.$search.'%')
                ->orWhereHas('contact', function (Builder $contactQuery) use ($search): void {
                    $contactQuery
                        ->where('first_name', 'like', '%'.$search.'%')
                        ->orWhere('last_name', 'like', '%'.$search.'%')
                        ->orWhere('email', 'like', '%'.$search.'%')
                        ->orWhere('company', 'like', '%'.$search.'%');
                })
                ->orWhereHas('emailAccount', fn (Builder $accountQuery) => $accountQuery->where('email_address', 'like', '%'.$search.'%'))
                ->orWhereHas('campaign', fn (Builder $campaignQuery) => $campaignQuery->where('name', 'like', '%'.$search.'%'))
                ->orWhereHas('emailLogs', function (Builder $logQuery) use ($search): void {
                    $logQuery
                        ->where('subject', 'like', '%'.$search.'%')
                        ->orWhere('body_preview', 'like', '%'.$search.'%')
                        ->orWhere('sender_email', 'like', '%'.$search.'%')
                        ->orWhere('recipient_email', 'like', '%'.$search.'%');
                });
        });
    }

    private function mailboxStats(Builder $baseQuery): array
    {
        return [
            'total' => (clone $baseQuery)->count(),
            'inbox' => tap(clone $baseQuery, fn (Builder $query) => $this->applyFolderFilter($query, 'inbox'))->count(),
            'sent' => tap(clone $baseQuery, fn (Builder $query) => $this->applyFolderFilter($query, 'sent'))->count(),
            'needs_reply' => tap(clone $baseQuery, fn (Builder $query) => $this->applyFolderFilter($query, 'needs_reply'))->count(),
            'replied' => tap(clone $baseQuery, fn (Builder $query) => $this->applyFolderFilter($query, 'replied'))->count(),
            'bounced' => tap(clone $baseQuery, fn (Builder $query) => $this->applyFolderFilter($query, 'bounced'))->count(),
        ];
    }

    private function replyFailureMessage(Throwable $exception): string
    {
        $message = trim($exception->getMessage());

        if ($message === '') {
            return 'Reply could not be sent. Check the sender mailbox SMTP settings and try again.';
        }

        if (str_contains($message, 'Maximum execution time')) {
            return 'Reply sending timed out. Check the sender mailbox SMTP host, port, encryption, and password.';
        }

        if (str_contains($message, 'stream_socket_enable_crypto') || str_contains($message, 'certificate')) {
            return 'SMTP encryption failed because the mailbox host certificate does not match. Update the SMTP host or encryption setting.';
        }

        return $message;
    }

    private function serializeMessage(EmailLog $log): array
    {
        return [
            'id' => $log->id,
            'direction' => $log->direction,
            'event_type' => $log->event_type,
            'subject' => $log->subject,
            'body_preview' => $log->body_preview,
            'body_text' => $log->metadata['body_text'] ?? null,
            'sender_email' => $log->sender_email,
            'recipient_email' => $log->recipient_email,
            'sent_at' => $log->sent_at?->toIso8601String(),
        ];
    }

    private function serializeThread(ConversationThread $thread, bool $includeMessages = true): array
    {
        $messages = $includeMessages && $thread->relationLoaded('emailLogs')
            ? $thread->emailLogs->map(fn ($log) => $this->serializeMessage($log))->values()
            : collect();
        $latestMessage = $thread->latestEmailLog ? $this->serializeMessage($thread->latestEmailLog) : null;
        $latestInboundMessage = $thread->latestInboundEmailLog ? $this->serializeMessage($thread->latestInboundEmailLog) : null;

        return [
            'id' => $thread->id,
            'subject' => $thread->subject,
            'status' => $thread->status,
            'last_message_at' => $thread->last_message_at?->toIso8601String(),
            'contact' => [
                'id' => $thread->contact?->id,
                'name' => $thread->contact?->full_name,
                'email' => $thread->contact?->email,
            ],
            'campaign' => $thread->campaign ? ['id' => $thread->campaign->id, 'name' => $thread->campaign->name] : null,
            'email_account' => $thread->emailAccount ? [
                'id' => $thread->emailAccount->id,
                'name' => $thread->emailAccount->name,
                'email_address' => $thread->emailAccount->email_address,
            ] : null,
            'latest_message' => $latestMessage,
            'latest_inbound_message' => $latestInboundMessage,
            'messages' => $messages->all(),
            'stats' => [
                'message_count' => $thread->message_count ?? $messages->count(),
                'inbound_count' => $thread->inbound_count ?? $messages->where('direction', 'inbound')->count(),
                'outbound_count' => $thread->outbound_count ?? $messages->where('direction', 'outbound')->count(),
                'has_inbound_reply' => $latestInboundMessage !== null,
            ],
        ];
    }
}
