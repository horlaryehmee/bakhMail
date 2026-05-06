<?php

namespace App\Jobs;

use App\Models\EmailAccount;
use App\Models\EmailLog;
use App\Services\DynamicSmtpMailer;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendWarmupEmailJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public readonly int $emailAccountId)
    {
    }

    public function handle(DynamicSmtpMailer $mailer): void
    {
        $account = EmailAccount::query()->find($this->emailAccountId);

        if (! $account || ! $account->warmup_enabled) {
            return;
        }

        $target = $account->warmup_target_email ?: config('bulkmail.warmup_default_recipient');

        if (! $target) {
            return;
        }

        $subject = 'Warmup ping from '.$account->name;
        $html = '<p>This is an automated warm-up email to maintain mailbox reputation and verify SMTP health.</p>';

        $result = $mailer->send($account, [
            'to' => $target,
            'subject' => $subject,
            'html' => $html,
            'text' => strip_tags($html),
        ]);

        EmailLog::create([
            'user_id' => $account->user_id,
            'email_account_id' => $account->id,
            'direction' => 'system',
            'event_type' => 'warmup',
            'provider_message_id' => trim($result['message_id'] ?? '', '<>'),
            'subject' => $subject,
            'recipient_email' => $target,
            'sender_email' => $account->email_address,
            'body_preview' => 'Warmup email sent.',
            'sent_at' => now(),
        ]);
    }
}
