<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ConversationThread;
use App\Models\EmailLog;
use App\Services\ActivityLogger;
use App\Services\DynamicSmtpMailer;
use App\Services\TrackingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class ConversationController extends Controller
{
    public function __construct(
        private readonly DynamicSmtpMailer $dynamicSmtpMailer,
        private readonly TrackingService $trackingService,
        private readonly ActivityLogger $activityLogger,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $threads = ConversationThread::query()
            ->where('user_id', $request->user()->id)
            ->with(['contact', 'campaign', 'emailLogs' => fn ($query) => $query->latest()->limit(3)])
            ->orderByDesc('last_message_at')
            ->get();

        return response()->json([
            'data' => $threads->map(fn (ConversationThread $thread) => [
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
                'messages' => $thread->emailLogs->map(fn ($log) => [
                    'id' => $log->id,
                    'direction' => $log->direction,
                    'event_type' => $log->event_type,
                    'subject' => $log->subject,
                    'body_preview' => $log->body_preview,
                    'body_text' => $log->metadata['body_text'] ?? null,
                    'sent_at' => $log->sent_at?->toIso8601String(),
                ])->all(),
            ])->all(),
        ]);
    }

    public function show(Request $request, ConversationThread $thread): JsonResponse
    {
        abort_unless($thread->user_id === $request->user()->id, 404);
        $thread->load(['contact', 'campaign', 'emailLogs' => fn ($query) => $query->latest()->limit(50)]);

        return response()->json([
            'data' => [
                'id' => $thread->id,
                'subject' => $thread->subject,
                'status' => $thread->status,
                'contact' => [
                    'id' => $thread->contact?->id,
                    'name' => $thread->contact?->full_name,
                    'email' => $thread->contact?->email,
                ],
                'campaign' => $thread->campaign ? ['id' => $thread->campaign->id, 'name' => $thread->campaign->name] : null,
                'messages' => $thread->emailLogs->map(fn ($log) => [
                    'id' => $log->id,
                    'direction' => $log->direction,
                    'event_type' => $log->event_type,
                    'subject' => $log->subject,
                    'body_preview' => $log->body_preview,
                    'body_text' => $log->metadata['body_text'] ?? null,
                    'sender_email' => $log->sender_email,
                    'recipient_email' => $log->recipient_email,
                    'sent_at' => $log->sent_at?->toIso8601String(),
                ])->all(),
            ],
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
}
