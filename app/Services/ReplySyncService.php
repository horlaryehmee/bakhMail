<?php

namespace App\Services;

use App\Models\Contact;
use App\Models\ConversationThread;
use App\Models\EmailAccount;
use App\Models\EmailLog;
use App\Models\SuppressionEntry;
use App\Models\Tag;
use App\Notifications\SystemEventNotification;
use Illuminate\Support\Facades\Log;

class ReplySyncService
{
    public function __construct(
        private readonly AnalyticsService $analyticsService,
    ) {
    }

    public function syncAll(): int
    {
        $synced = 0;

        EmailAccount::query()
            ->where('status', 'active')
            ->whereNotNull('imap_host')
            ->chunkById(25, function ($accounts) use (&$synced): void {
                foreach ($accounts as $account) {
                    $synced += $this->syncAccount($account);
                }
            });

        return $synced;
    }

    public function syncAccount(EmailAccount $account): int
    {
        if (! $account->hasImapConfiguration()) {
            return 0;
        }

        if (! $this->isResolvableHost((string) $account->imap_host)) {
            Log::warning('Reply sync skipped because IMAP host could not be resolved.', [
                'email_account_id' => $account->id,
                'imap_host' => $account->imap_host,
                'email_address' => $account->email_address,
            ]);

            return 0;
        }

        $mailbox = $this->mailboxPath($account);
        $connection = $this->openMailbox($mailbox, $account);

        if (! $connection) {
            return 0;
        }

        $messageNumbers = imap_search($connection, 'UNSEEN') ?: [];
        $synced = 0;

        foreach ($messageNumbers as $messageNumber) {
            $headerInfo = imap_headerinfo($connection, $messageNumber);
            $headers = imap_fetchheader($connection, $messageNumber);
            $body = trim(strip_tags(imap_body($connection, $messageNumber)));
            $messageId = trim($this->extractHeaderValue($headers, 'Message-ID'), '<>');

            if ($messageId && EmailLog::query()->where('provider_message_id', $messageId)->exists()) {
                continue;
            }

            $fromAddress = $this->headerAddress($headerInfo);
            $contact = Contact::query()
                ->where('user_id', $account->user_id)
                ->where('email', strtolower($fromAddress))
                ->first();

            if (! $contact) {
                continue;
            }

            $eventType = $this->isBounce($fromAddress, $headerInfo->subject ?? '', $body) ? 'bounced' : 'replied';
            $inReplyTo = trim($this->extractHeaderValue($headers, 'In-Reply-To'), '<>');
            $sourceLog = $inReplyTo ? EmailLog::query()->where('provider_message_id', $inReplyTo)->first() : null;
            $thread = $sourceLog?->thread ?: ConversationThread::firstOrCreate(
                [
                    'user_id' => $account->user_id,
                    'contact_id' => $contact->id,
                    'campaign_id' => $sourceLog?->campaign_id,
                ],
                [
                    'email_account_id' => $account->id,
                    'subject' => $headerInfo->subject ?? 'Reply',
                    'status' => 'open',
                    'last_message_at' => now(),
                ],
            );

            $log = EmailLog::create([
                'user_id' => $account->user_id,
                'campaign_id' => $sourceLog?->campaign_id,
                'campaign_step_id' => null,
                'campaign_recipient_id' => $sourceLog?->campaign_recipient_id,
                'contact_id' => $contact->id,
                'email_account_id' => $account->id,
                'conversation_thread_id' => $thread->id,
                'direction' => 'inbound',
                'event_type' => $eventType,
                'provider_message_id' => $messageId,
                'in_reply_to' => $inReplyTo ?: null,
                'subject' => $headerInfo->subject ?? null,
                'recipient_email' => $account->email_address,
                'sender_email' => $fromAddress,
                'body_preview' => mb_substr($body, 0, 250),
                'sent_at' => now(),
            ]);

            $thread->update([
                'last_message_at' => now(),
                'status' => $eventType === 'bounced' ? 'attention' : 'open',
            ]);

            $this->applyContactState($contact, $eventType, $body);
            $this->applyRecipientState($sourceLog?->recipient, $eventType);
            $this->applyAutoTag($contact, $eventType, $body);
            $campaign = $sourceLog?->campaign ?? $thread->campaign;

            if ($campaign) {
                $this->analyticsService->refreshCampaign($campaign);
            }
            $account->user->notify(new SystemEventNotification(
                title: $eventType === 'bounced' ? 'Bounce detected' : 'New reply received',
                message: $eventType === 'bounced'
                    ? "{$contact->email} bounced from {$account->email_address}."
                    : "{$contact->full_name} replied to {$account->email_address}.",
                level: $eventType === 'bounced' ? 'warning' : 'success',
                meta: ['thread_id' => $thread->id, 'email_log_id' => $log->id],
            ));

            @imap_setflag_full($connection, (string) $messageNumber, "\\Seen");
            $synced++;
        }

        imap_close($connection);
        $account->update(['last_synced_at' => now()]);

        return $synced;
    }

    private function mailboxPath(EmailAccount $account): string
    {
        $flag = match ($account->imap_encryption) {
            'ssl' => '/imap/ssl',
            'tls' => '/imap/tls',
            default => '/imap/notls',
        };

        return sprintf('{%s:%d%s}INBOX', $account->imap_host, $account->imap_port, $flag);
    }

    private function openMailbox(string $mailbox, EmailAccount $account): mixed
    {
        $lastWarning = null;
        set_error_handler(function (int $severity, string $message) use (&$lastWarning): bool {
            $lastWarning = $message;

            return true;
        });

        try {
            $connection = imap_open($mailbox, $account->imap_username, $account->imap_password ?? '');
        } finally {
            restore_error_handler();
        }

        if (! $connection) {
            Log::warning('Reply sync could not open IMAP mailbox.', [
                'email_account_id' => $account->id,
                'imap_host' => $account->imap_host,
                'email_address' => $account->email_address,
                'warning' => $lastWarning,
                'imap_errors' => imap_errors() ?: [],
            ]);
        }

        return $connection;
    }

    private function headerAddress(object $headerInfo): string
    {
        $from = $headerInfo->from[0] ?? null;

        return strtolower(trim(($from->mailbox ?? '').'@'.($from->host ?? '')));
    }

    private function extractHeaderValue(string $headers, string $name): string
    {
        preg_match('/^'.preg_quote($name, '/').':\s*(.+)$/mi', $headers, $matches);

        return trim($matches[1] ?? '');
    }

    private function isResolvableHost(string $host): bool
    {
        $host = trim($host);

        if ($host === '') {
            return false;
        }

        if (filter_var($host, FILTER_VALIDATE_IP)) {
            return true;
        }

        return gethostbyname($host) !== $host;
    }

    private function isBounce(string $fromAddress, string $subject, string $body): bool
    {
        return str_contains($fromAddress, 'mailer-daemon')
            || preg_match('/undeliver|delivery status|failure notice/i', $subject.' '.$body) === 1;
    }

    private function applyContactState(Contact $contact, string $eventType, string $body): void
    {
        if ($eventType === 'bounced') {
            $contact->update([
                'status' => 'bounced',
                'bounced_at' => now(),
            ]);

            SuppressionEntry::updateOrCreate(
                ['user_id' => $contact->user_id, 'email' => $contact->email],
                ['reason' => 'bounce', 'source' => 'imap'],
            );

            return;
        }

        $updates = [
            'status' => 'replied',
            'replied_at' => now(),
        ];

        if (preg_match('/unsubscribe|remove me|stop emailing/i', $body)) {
            $updates['status'] = 'unsubscribed';
            $updates['unsubscribed_at'] = now();

            SuppressionEntry::updateOrCreate(
                ['user_id' => $contact->user_id, 'email' => $contact->email],
                ['reason' => 'unsubscribe', 'source' => 'reply'],
            );
        }

        $contact->update($updates);
    }

    private function applyRecipientState($recipient, string $eventType): void
    {
        if (! $recipient) {
            return;
        }

        $recipient->update([
            'status' => $eventType === 'bounced' ? 'bounced' : 'replied',
            $eventType === 'bounced' ? 'bounced_at' : 'replied_at' => now(),
        ]);
    }

    private function applyAutoTag(Contact $contact, string $eventType, string $body): void
    {
        $tagName = match (true) {
            $eventType === 'bounced' => 'bounced',
            preg_match('/interested|let\'s talk|sounds good/i', $body) === 1 => 'interested',
            preg_match('/unsubscribe|remove me|stop emailing/i', $body) === 1 => 'unsubscribe',
            default => 'replied',
        };

        $tag = Tag::firstOrCreate(
            ['user_id' => $contact->user_id, 'name' => $tagName],
            ['color' => $tagName === 'bounced' ? '#ef4444' : '#0f766e'],
        );

        $contact->tags()->syncWithoutDetaching([$tag->id]);
    }
}
