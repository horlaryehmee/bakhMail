<?php

namespace App\Services;

use App\Models\Contact;
use App\Models\ConversationThread;
use App\Models\EmailAccount;
use App\Models\EmailLog;
use App\Models\SuppressionEntry;
use App\Models\Tag;
use App\Notifications\SystemEventNotification;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Log;
use Throwable;

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

        if (! function_exists('imap_open')) {
            Log::warning('Reply sync skipped because the PHP IMAP extension is unavailable.', [
                'email_account_id' => $account->id,
                'email_address' => $account->email_address,
            ]);

            return 0;
        }

        $imapHost = $this->normalizeHost((string) $account->imap_host);

        if (! $imapHost || ! $this->isResolvableHost($imapHost)) {
            Log::warning('Reply sync skipped because IMAP host could not be resolved.', [
                'email_account_id' => $account->id,
                'imap_host' => $account->imap_host,
                'email_address' => $account->email_address,
            ]);

            return 0;
        }

        $mailbox = $this->mailboxPath($account, $imapHost);
        $connection = $this->openMailbox($mailbox, $account, $imapHost);

        if (! $connection) {
            return 0;
        }

        $synced = 0;

        try {
            $this->clearImapState();
            $messageNumbers = imap_search($connection, 'UNSEEN') ?: [];

            foreach ($messageNumbers as $messageNumber) {
                $headerInfo = imap_headerinfo($connection, $messageNumber);
                $headers = imap_fetchheader($connection, $messageNumber);
                $body = $this->extractMessageBody($connection, $messageNumber);
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
                $messageTimestamp = $this->resolveMessageTimestamp($headerInfo?->date ?? null);
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
                        'last_message_at' => $messageTimestamp,
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
                    'sent_at' => $messageTimestamp,
                    'metadata' => [
                        'body_text' => $body,
                    ],
                ]);

                $thread->update([
                    'last_message_at' => $messageTimestamp,
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
        } catch (Throwable $exception) {
            Log::warning('Reply sync stopped because an IMAP operation failed.', [
                'email_account_id' => $account->id,
                'imap_host' => $account->imap_host,
                'email_address' => $account->email_address,
                'message' => $exception->getMessage(),
                'imap_errors' => $this->clearImapState(),
            ]);
        } finally {
            @imap_close($connection);
            $this->clearImapState();
        }

        $account->update(['last_synced_at' => now()]);

        return $synced;
    }

    private function mailboxPath(EmailAccount $account, string $imapHost): string
    {
        $flag = match ($account->imap_encryption) {
            'ssl' => '/imap/ssl',
            'tls' => '/imap/tls',
            default => '/imap/notls',
        };

        return sprintf('{%s:%d%s}INBOX', $imapHost, $account->imap_port, $flag);
    }

    private function openMailbox(string $mailbox, EmailAccount $account, string $imapHost): mixed
    {
        $lastWarning = null;
        $this->clearImapState();

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
                'imap_host' => $imapHost,
                'email_address' => $account->email_address,
                'warning' => $lastWarning,
                'imap_errors' => $this->clearImapState(),
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

    private function normalizeHost(string $host): ?string
    {
        $host = strtolower(trim($host));

        if ($host === '') {
            return null;
        }

        $host = preg_replace('#^[a-z][a-z0-9+.-]*://#i', '', $host) ?? $host;
        $host = explode('/', $host, 2)[0];
        $host = explode(':', $host, 2)[0];
        $host = trim($host, " \t\n\r\0\x0B.");

        return $host !== '' ? $host : null;
    }

    private function resolveMessageTimestamp(?string $dateHeader): CarbonImmutable
    {
        if (! $dateHeader) {
            return now()->toImmutable();
        }

        try {
            return CarbonImmutable::parse($dateHeader);
        } catch (Throwable) {
            return now()->toImmutable();
        }
    }

    private function extractMessageBody($connection, int $messageNumber): string
    {
        $body = imap_body($connection, $messageNumber) ?: '';
        $decoded = quoted_printable_decode($body);
        $decoded = base64_decode($decoded, true) ?: $decoded;
        $decoded = preg_replace("/\r\n|\r/u", "\n", strip_tags($decoded)) ?? '';
        $decoded = preg_replace("/\n{3,}/u", "\n\n", $decoded) ?? $decoded;

        return trim($decoded);
    }

    private function clearImapState(): array
    {
        $errors = imap_errors() ?: [];
        $alerts = imap_alerts() ?: [];

        return array_values(array_filter([...$errors, ...$alerts]));
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
