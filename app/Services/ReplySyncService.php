<?php

namespace App\Services;

use App\Models\Contact;
use App\Models\ConversationThread;
use App\Models\EmailAccount;
use App\Models\EmailLog;
use App\Models\SuppressionEntry;
use App\Models\Tag;
use App\Models\User;
use App\Notifications\SystemEventNotification;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

class ReplySyncService
{
    private const INBOX_FOLDER_KEY = 'inbox';

    private const SENT_FOLDER_KEY = 'sent';

    private const BOOTSTRAP_MESSAGE_LIMIT = 75;

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

    public function syncUser(User $user): int
    {
        $synced = 0;

        $user->emailAccounts()
            ->where('status', 'active')
            ->whereNotNull('imap_host')
            ->get()
            ->each(function (EmailAccount $account) use (&$synced): void {
                $synced += $this->syncAccount($account);
            });

        return $synced;
    }

    public function syncAccount(EmailAccount $account): int
    {
        if (! $account->hasImapConfiguration()) {
            return 0;
        }

        if (! function_exists('imap_open')) {
            Log::warning('Mailbox sync skipped because the PHP IMAP extension is unavailable.', [
                'email_account_id' => $account->id,
                'email_address' => $account->email_address,
            ]);

            return 0;
        }

        $imapHost = $this->resolveImapHost($account);

        if (! $imapHost || ! $this->isResolvableHost($imapHost)) {
            Log::warning('Mailbox sync skipped because IMAP host could not be resolved.', [
                'email_account_id' => $account->id,
                'imap_host' => $account->imap_host,
                'email_address' => $account->email_address,
            ]);

            return 0;
        }

        $rootPath = $this->mailboxRootPath($account, $imapHost);
        $mailboxes = $this->discoverMailboxNames($rootPath, $account, $imapHost);
        $syncState = (array) (($account->metadata ?? [])['imap_sync_state'] ?? []);
        $synced = 0;

        foreach ($mailboxes as $folderKey => $mailboxName) {
            $mailbox = $rootPath.$mailboxName;
            $connection = $this->openMailbox($mailbox, $account, $imapHost);

            if (! $connection) {
                continue;
            }

            try {
                [$folderSynced, $lastUid] = $this->syncMailboxFolder($connection, $account, $folderKey, $mailboxName, (int) ($syncState[$folderKey]['last_uid'] ?? 0));
                $synced += $folderSynced;
                $syncState[$folderKey] = [
                    'last_uid' => $lastUid,
                    'mailbox' => $mailboxName,
                    'synced_at' => now()->toIso8601String(),
                ];
            } catch (Throwable $exception) {
                Log::warning('Mailbox sync stopped because an IMAP operation failed.', [
                    'email_account_id' => $account->id,
                    'mailbox' => $mailboxName,
                    'imap_host' => $account->imap_host,
                    'email_address' => $account->email_address,
                    'message' => $exception->getMessage(),
                    'imap_errors' => $this->clearImapState(),
                ]);
            } finally {
                @imap_close($connection);
                $this->clearImapState();
            }
        }

        $metadata = (array) ($account->metadata ?? []);
        $metadata['imap_sync_state'] = $syncState;
        $metadata['imap_mailboxes'] = $mailboxes;

        $account->update([
            'last_synced_at' => now(),
            'metadata' => $metadata,
        ]);

        return $synced;
    }

    private function syncMailboxFolder($connection, EmailAccount $account, string $folderKey, string $mailboxName, int $lastUid): array
    {
        $messageNumbers = $this->messageNumbersForFolder($connection, $lastUid);
        $maxUid = $lastUid;
        $synced = 0;

        foreach ($messageNumbers as $messageNumber) {
            $uid = (int) imap_uid($connection, $messageNumber);
            $maxUid = max($maxUid, $uid);

            $headerInfo = imap_headerinfo($connection, $messageNumber);
            $headers = (string) (imap_fetchheader($connection, $messageNumber) ?: '');
            $messageId = trim($this->extractHeaderValue($headers, 'Message-ID'), '<>');
            $providerMessageId = $messageId !== '' ? $messageId : sprintf('imap:%d:%s:%d', $account->id, $folderKey, $uid);

            if (EmailLog::query()->where('provider_message_id', $providerMessageId)->exists()) {
                continue;
            }

            $direction = $this->resolveDirection($folderKey, $headerInfo, $account);
            $participant = $this->resolveParticipant($headerInfo, $direction, $account);

            if (! $participant['email']) {
                continue;
            }

            $contact = $this->findOrCreateContact($account, $participant['email'], $participant['name']);

            if (! $contact) {
                continue;
            }

            $body = $this->extractMessageBody($connection, $messageNumber);
            $subject = $this->decodeMimeHeader((string) ($headerInfo->subject ?? '')) ?: null;
            $references = $this->extractMessageReferences($headers);
            $sourceLog = $this->findSourceLog($providerMessageId, $references);
            $messageTimestamp = $this->resolveMessageTimestamp($headerInfo->date ?? null);
            $thread = $this->resolveThread($account, $contact, $subject, $sourceLog, $messageTimestamp);
            $eventType = $direction === 'inbound'
                ? ($this->isBounce($participant['email'], $subject ?? '', $body) ? 'bounced' : 'replied')
                : 'sent';

            $log = EmailLog::create([
                'user_id' => $account->user_id,
                'campaign_id' => $sourceLog?->campaign_id,
                'campaign_step_id' => $sourceLog?->campaign_step_id,
                'campaign_recipient_id' => $sourceLog?->campaign_recipient_id,
                'contact_id' => $contact->id,
                'email_account_id' => $account->id,
                'conversation_thread_id' => $thread->id,
                'direction' => $direction,
                'event_type' => $eventType,
                'provider_message_id' => $providerMessageId,
                'in_reply_to' => $references->first(),
                'subject' => $subject,
                'recipient_email' => $direction === 'outbound' ? $participant['email'] : $account->email_address,
                'sender_email' => $direction === 'outbound' ? $account->email_address : $participant['email'],
                'body_preview' => mb_substr($body, 0, 250),
                'sent_at' => $messageTimestamp,
                'metadata' => [
                    'body_text' => $body,
                    'imap_mailbox' => $mailboxName,
                    'imap_folder' => $folderKey,
                    'imap_uid' => $uid,
                    'message_references' => $references->values()->all(),
                ],
            ]);

            $thread->update([
                'email_account_id' => $account->id,
                'subject' => $subject ?: ($thread->subject ?: 'Conversation'),
                'last_message_at' => $messageTimestamp,
                'status' => $eventType === 'bounced' ? 'attention' : 'open',
            ]);

            if ($direction === 'inbound') {
                $this->applyInboundState($account, $contact, $eventType, $body, $thread, $log, $sourceLog);
            }

            $synced++;
        }

        return [$synced, $maxUid];
    }

    private function messageNumbersForFolder($connection, int $lastUid): array
    {
        $messageNumbers = imap_search($connection, 'ALL') ?: [];

        if ($messageNumbers === []) {
            return [];
        }

        $messages = collect($messageNumbers)
            ->map(fn ($messageNumber) => [
                'number' => (int) $messageNumber,
                'uid' => (int) imap_uid($connection, (int) $messageNumber),
            ])
            ->sortBy('uid')
            ->values();

        if ($lastUid > 0) {
            return $messages
                ->filter(fn (array $message) => $message['uid'] > $lastUid)
                ->pluck('number')
                ->all();
        }

        return $messages
            ->slice(-self::BOOTSTRAP_MESSAGE_LIMIT)
            ->pluck('number')
            ->all();
    }

    private function resolveDirection(string $folderKey, object $headerInfo, EmailAccount $account): string
    {
        if ($folderKey === self::SENT_FOLDER_KEY) {
            return 'outbound';
        }

        $fromAddress = strtolower((string) ($this->addressesFromHeader($headerInfo->from ?? [])->first()['email'] ?? ''));

        return $fromAddress === strtolower($account->email_address) ? 'outbound' : 'inbound';
    }

    private function resolveParticipant(object $headerInfo, string $direction, EmailAccount $account): array
    {
        if ($direction === 'outbound') {
            $recipient = $this->addressesFromHeader($headerInfo->to ?? [])
                ->first(fn (array $address) => $address['email'] !== strtolower($account->email_address));

            return $recipient ?? ['email' => null, 'name' => null];
        }

        return $this->addressesFromHeader($headerInfo->from ?? [])->first() ?? ['email' => null, 'name' => null];
    }

    private function addressesFromHeader(array $addresses): Collection
    {
        return collect($addresses)
            ->map(function ($address): array {
                $email = strtolower(trim(($address->mailbox ?? '').'@'.($address->host ?? '')));
                $name = $this->decodeMimeHeader((string) ($address->personal ?? ''));

                return [
                    'email' => filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : null,
                    'name' => $name ?: null,
                ];
            })
            ->filter(fn (array $address) => filled($address['email']))
            ->values();
    }

    private function findOrCreateContact(EmailAccount $account, string $email, ?string $name): ?Contact
    {
        $email = strtolower(trim($email));

        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return null;
        }

        $contact = Contact::query()->firstOrNew([
            'user_id' => $account->user_id,
            'email' => $email,
        ]);

        if ($contact->exists) {
            return $contact;
        }

        [$firstName, $lastName] = $this->splitName($name);

        $contact->fill([
            'first_name' => $firstName,
            'last_name' => $lastName,
            'status' => 'active',
        ]);
        $contact->save();

        return $contact;
    }

    private function splitName(?string $name): array
    {
        $name = trim((string) $name);

        if ($name === '') {
            return [null, null];
        }

        $parts = preg_split('/\s+/', $name) ?: [];
        $firstName = array_shift($parts) ?: null;
        $lastName = $parts !== [] ? implode(' ', $parts) : null;

        return [$firstName, $lastName];
    }

    private function resolveThread(
        EmailAccount $account,
        Contact $contact,
        ?string $subject,
        ?EmailLog $sourceLog,
        CarbonImmutable $messageTimestamp,
    ): ConversationThread {
        if ($sourceLog?->thread) {
            return $sourceLog->thread;
        }

        $normalizedSubject = $this->normalizeSubject($subject);

        $existing = ConversationThread::query()
            ->where('user_id', $account->user_id)
            ->where('contact_id', $contact->id)
            ->where('email_account_id', $account->id)
            ->get()
            ->first(function (ConversationThread $thread) use ($normalizedSubject): bool {
                return $this->normalizeSubject($thread->subject) === $normalizedSubject;
            });

        if ($existing) {
            return $existing;
        }

        return ConversationThread::create([
            'user_id' => $account->user_id,
            'contact_id' => $contact->id,
            'campaign_id' => $sourceLog?->campaign_id,
            'email_account_id' => $account->id,
            'subject' => $subject ?: 'Conversation',
            'status' => 'open',
            'last_message_at' => $messageTimestamp,
        ]);
    }

    private function normalizeSubject(?string $subject): string
    {
        $subject = strtolower(trim((string) $subject));

        if ($subject === '') {
            return '';
        }

        do {
            $previous = $subject;
            $subject = preg_replace('/^(re|fwd|fw)\s*:\s*/i', '', $subject) ?? $subject;
        } while ($subject !== $previous);

        return $subject;
    }

    private function findSourceLog(string $providerMessageId, Collection $references): ?EmailLog
    {
        $referenceIds = $references
            ->prepend($providerMessageId)
            ->filter()
            ->unique()
            ->values();

        if ($referenceIds->isEmpty()) {
            return null;
        }

        return EmailLog::query()
            ->whereIn('provider_message_id', $referenceIds->all())
            ->latest('sent_at')
            ->latest('id')
            ->first();
    }

    private function extractMessageReferences(string $headers): Collection
    {
        $references = [];

        foreach (['In-Reply-To', 'References'] as $headerName) {
            $value = $this->extractHeaderValue($headers, $headerName);

            if ($value === '') {
                continue;
            }

            preg_match_all('/<([^>]+)>/', $value, $matches);

            foreach (($matches[1] ?? []) as $messageId) {
                $references[] = trim($messageId);
            }
        }

        return collect($references)->filter()->unique()->values();
    }

    private function mailboxRootPath(EmailAccount $account, string $imapHost): string
    {
        $flag = match ($account->imap_encryption) {
            'ssl' => '/imap/ssl',
            'tls' => '/imap/tls',
            default => '/imap/notls',
        };

        return sprintf('{%s:%d%s}', $imapHost, $account->imap_port, $flag);
    }

    private function discoverMailboxNames(string $rootPath, EmailAccount $account, string $imapHost): array
    {
        $mailboxes = [];
        $connection = $this->openMailbox($rootPath.'INBOX', $account, $imapHost);

        if (! $connection) {
            return [
                self::INBOX_FOLDER_KEY => 'INBOX',
            ];
        }

        try {
            $rawMailboxes = imap_getmailboxes($connection, $rootPath, '*') ?: [];
            $names = collect($rawMailboxes)
                ->map(fn ($mailbox) => str_replace($rootPath, '', imap_utf7_decode($mailbox->name)))
                ->filter()
                ->values();

            $mailboxes[self::INBOX_FOLDER_KEY] = $names->first(fn (string $name) => strtoupper($name) === 'INBOX') ?: 'INBOX';

            $sentCandidates = [
                'sent',
                'sent items',
                'sent mail',
                'sent messages',
                'inbox.sent',
                'inbox/sent',
                'mail/sent',
            ];

            $normalizedNames = $names->mapWithKeys(fn (string $name) => [$this->normalizeMailboxName($name) => $name]);

            foreach ($sentCandidates as $candidate) {
                $matched = $normalizedNames->get($this->normalizeMailboxName($candidate));

                if ($matched) {
                    $mailboxes[self::SENT_FOLDER_KEY] = $matched;
                    break;
                }
            }

            if (! isset($mailboxes[self::SENT_FOLDER_KEY])) {
                $matched = $names->first(fn (string $name) => str_contains($this->normalizeMailboxName($name), 'sent'));

                if ($matched) {
                    $mailboxes[self::SENT_FOLDER_KEY] = $matched;
                }
            }
        } finally {
            @imap_close($connection);
            $this->clearImapState();
        }

        return $mailboxes;
    }

    private function normalizeMailboxName(string $name): string
    {
        return strtolower(trim(str_replace(['\\', '/'], '.', $name)));
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
            Log::warning('Mailbox sync could not open IMAP mailbox.', [
                'email_account_id' => $account->id,
                'mailbox' => $mailbox,
                'imap_host' => $imapHost,
                'email_address' => $account->email_address,
                'warning' => $lastWarning,
                'imap_errors' => $this->clearImapState(),
            ]);
        }

        return $connection;
    }

    private function extractHeaderValue(string $headers, string $name): string
    {
        preg_match('/^'.preg_quote($name, '/').':\s*(.+)$/mi', $headers, $matches);

        return trim($matches[1] ?? '');
    }

    private function decodeMimeHeader(string $value): string
    {
        if ($value === '') {
            return '';
        }

        $decoded = @iconv_mime_decode($value, ICONV_MIME_DECODE_CONTINUE_ON_ERROR, 'UTF-8');

        return trim($decoded !== false ? $decoded : $value);
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
        $structure = imap_fetchstructure($connection, $messageNumber);

        if (! $structure) {
            return $this->cleanBody((string) (imap_body($connection, $messageNumber) ?: ''));
        }

        $plainText = $this->findBodyPart($connection, $messageNumber, $structure, 'plain');

        if ($plainText !== null) {
            return $plainText;
        }

        $html = $this->findBodyPart($connection, $messageNumber, $structure, 'html');

        if ($html !== null) {
            return $this->cleanBody(strip_tags($html));
        }

        return $this->cleanBody((string) (imap_body($connection, $messageNumber) ?: ''));
    }

    private function findBodyPart($connection, int $messageNumber, object $structure, string $preferredSubtype, string $partNumber = ''): ?string
    {
        $subtype = strtolower((string) ($structure->subtype ?? ''));

        if (($structure->type ?? null) === 0 && $subtype === $preferredSubtype) {
            $body = $partNumber !== ''
                ? (imap_fetchbody($connection, $messageNumber, $partNumber) ?: '')
                : (imap_body($connection, $messageNumber) ?: '');

            return $this->decodePartBody($body, (int) ($structure->encoding ?? 0), $preferredSubtype === 'html');
        }

        foreach (($structure->parts ?? []) as $index => $part) {
            $childPartNumber = $partNumber === '' ? (string) ($index + 1) : $partNumber.'.'.($index + 1);
            $body = $this->findBodyPart($connection, $messageNumber, $part, $preferredSubtype, $childPartNumber);

            if ($body !== null) {
                return $body;
            }
        }

        return null;
    }

    private function decodePartBody(string $body, int $encoding, bool $isHtml): string
    {
        $decoded = match ($encoding) {
            3 => base64_decode($body, true) ?: $body,
            4 => quoted_printable_decode($body),
            default => $body,
        };

        if ($isHtml) {
            $decoded = strip_tags($decoded);
        }

        return $this->cleanBody($decoded);
    }

    private function cleanBody(string $body): string
    {
        $body = preg_replace("/\r\n|\r/u", "\n", $body) ?? $body;
        $body = preg_replace("/\n{3,}/u", "\n\n", $body) ?? $body;

        return trim($body);
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

    private function resolveImapHost(EmailAccount $account): ?string
    {
        $configuredHost = $this->normalizeHost((string) $account->imap_host);

        if ($configuredHost && $this->isResolvableHost($configuredHost)) {
            return $configuredHost;
        }

        $domain = strtolower(trim((string) substr(strrchr($account->email_address, '@') ?: '', 1)));

        if ($domain === '') {
            return null;
        }

        $records = dns_get_record($domain, DNS_MX);

        if (! is_array($records) || $records === []) {
            return null;
        }

        usort($records, fn (array $a, array $b) => ($a['pri'] ?? PHP_INT_MAX) <=> ($b['pri'] ?? PHP_INT_MAX));

        foreach ($records as $record) {
            $target = $this->normalizeHost((string) ($record['target'] ?? ''));

            if ($target && $this->isResolvableHost($target)) {
                $preferredTarget = $this->resolvePreferredMailHost($target) ?? $target;

                if ($configuredHost && $configuredHost !== $target) {
                    Log::warning('IMAP host did not resolve, so the domain MX host was used as a fallback.', [
                        'email_account_id' => $account->id,
                        'configured_host' => $configuredHost,
                        'fallback_host' => $preferredTarget,
                        'email_address' => $account->email_address,
                    ]);
                }

                return $preferredTarget;
            }
        }

        return null;
    }

    private function resolvePreferredMailHost(string $host): ?string
    {
        $ip = gethostbyname($host);

        if ($ip === $host || ! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
            return null;
        }

        $ptrHost = $this->normalizeHost(gethostbyaddr($ip) ?: '');

        if ($ptrHost && $this->isResolvableHost($ptrHost)) {
            return $ptrHost;
        }

        return null;
    }

    private function applyInboundState(
        EmailAccount $account,
        Contact $contact,
        string $eventType,
        string $body,
        ConversationThread $thread,
        EmailLog $log,
        ?EmailLog $sourceLog,
    ): void {
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
