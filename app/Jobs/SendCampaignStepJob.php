<?php

namespace App\Jobs;

use App\Models\CampaignRecipient;
use App\Models\CampaignStep;
use App\Models\ConversationThread;
use App\Models\EmailLog;
use App\Models\SuppressionEntry;
use App\Notifications\SystemEventNotification;
use App\Services\ActivityLogger;
use App\Services\AnalyticsService;
use App\Services\CampaignOrchestrator;
use App\Services\DynamicSmtpMailer;
use App\Services\PlaceholderService;
use App\Services\TrackingService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Str;
use Throwable;

class SendCampaignStepJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public array $backoff = [60, 300, 900];

    public function __construct(
        public readonly int $recipientId,
        public readonly int $stepId,
    ) {
    }

    public function handle(
        DynamicSmtpMailer $mailer,
        PlaceholderService $placeholders,
        TrackingService $tracking,
        CampaignOrchestrator $orchestrator,
        AnalyticsService $analytics,
        ActivityLogger $activityLogger,
    ): void {
        $recipient = CampaignRecipient::query()
            ->with(['campaign.user', 'contact', 'emailAccount', 'campaign.steps'])
            ->find($this->recipientId);
        $step = CampaignStep::query()->find($this->stepId);

        if (! $recipient || ! $step || ! $recipient->emailAccount) {
            return;
        }

        if (in_array($recipient->status, ['replied', 'bounced', 'unsubscribed', 'completed'], true)) {
            return;
        }

        if (SuppressionEntry::query()->where('user_id', $recipient->campaign->user_id)->where('email', $recipient->contact->email)->exists()) {
            $recipient->update([
                'status' => 'suppressed',
                'unsubscribed_at' => now(),
            ]);

            return;
        }

        $thread = ConversationThread::firstOrCreate(
            [
                'user_id' => $recipient->campaign->user_id,
                'contact_id' => $recipient->contact_id,
                'campaign_id' => $recipient->campaign_id,
            ],
            [
                'email_account_id' => $recipient->email_account_id,
                'subject' => $step->subject,
                'status' => 'open',
                'last_message_at' => now(),
            ],
        );

        $log = EmailLog::create([
            'user_id' => $recipient->campaign->user_id,
            'campaign_id' => $recipient->campaign_id,
            'campaign_step_id' => $step->id,
            'campaign_recipient_id' => $recipient->id,
            'contact_id' => $recipient->contact_id,
            'email_account_id' => $recipient->email_account_id,
            'conversation_thread_id' => $thread->id,
            'direction' => 'outbound',
            'event_type' => 'queued',
            'subject' => $step->subject,
            'recipient_email' => $recipient->contact->email,
            'sender_email' => $recipient->emailAccount->email_address,
            'tracking_token' => (string) Str::uuid(),
            'unsubscribe_token' => $recipient->contact->unsubscribe_token,
        ]);

        $subject = $placeholders->render($step->subject, $recipient->contact, $recipient->campaign, $recipient->emailAccount);
        $html = $placeholders->render($step->body_html, $recipient->contact, $recipient->campaign, $recipient->emailAccount);
        $text = $step->body_text
            ? $placeholders->render($step->body_text, $recipient->contact, $recipient->campaign, $recipient->emailAccount)
            : strip_tags($html);
        $html = $tracking->decorate($log, $html);

        $headers = [];
        $lastMessageId = $thread->emailLogs()->whereNotNull('provider_message_id')->latest('id')->value('provider_message_id');

        if ($lastMessageId) {
            $headers['In-Reply-To'] = $lastMessageId;
            $headers['References'] = $lastMessageId;
        }

        try {
            $result = $mailer->send($recipient->emailAccount, [
                'to' => $recipient->contact->email,
                'subject' => $subject,
                'html' => $html,
                'text' => $text,
                'headers' => $headers,
            ]);

            $log->update([
                'event_type' => 'sent',
                'provider_message_id' => trim($result['message_id'] ?? '', '<>'),
                'subject' => $subject,
                'body_preview' => mb_substr(strip_tags($html), 0, 240),
                'sent_at' => now(),
            ]);

            $recipient->update([
                'current_step_order' => $step->step_order,
                'status' => 'sent',
                'last_sent_at' => now(),
            ]);

            $recipient->contact->update([
                'last_contacted_at' => now(),
            ]);

            $thread->update([
                'last_message_at' => now(),
            ]);

            $activityLogger->log(
                user: $recipient->campaign->user,
                action: 'campaign.step.sent',
                subject: $recipient->campaign,
                properties: [
                    'recipient_id' => $recipient->id,
                    'step_id' => $step->id,
                    'contact_email' => $recipient->contact->email,
                ],
                description: "Sent {$recipient->campaign->name} step {$step->step_order} to {$recipient->contact->email}.",
            );

            $orchestrator->queueNextStep($recipient->fresh());
            $analytics->refreshCampaign($recipient->campaign->fresh());
        } catch (Throwable $exception) {
            $log->update([
                'event_type' => 'failed',
                'body_preview' => $exception->getMessage(),
                'metadata' => ['attempt' => $this->attempts()],
            ]);

            if ($this->attempts() >= $this->tries) {
                $recipient->update(['status' => 'failed']);

                $recipient->campaign->user->notify(new SystemEventNotification(
                    title: 'Campaign send failed',
                    message: "{$recipient->contact->email} failed after {$this->attempts()} attempts.",
                    level: 'error',
                    meta: ['campaign_id' => $recipient->campaign_id, 'recipient_id' => $recipient->id],
                ));
            }

            throw $exception;
        }
    }
}
