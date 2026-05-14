<?php

namespace App\Services;

use App\Models\EmailAccount;
use Illuminate\Support\Facades\Log;
use RuntimeException;
use Symfony\Component\Mailer\Transport;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;

class DynamicSmtpMailer
{
    public function send(EmailAccount $account, array $payload): array
    {
        $dsns = $this->resolveDsns($account);

        if ($dsns === []) {
            throw new RuntimeException('SMTP settings are incomplete for this account.');
        }

        $email = (new Email())
            ->from(new Address($account->email_address, $account->from_name ?: $account->name))
            ->to($payload['to'])
            ->subject($payload['subject'])
            ->html($payload['html']);

        if (! empty($payload['text'])) {
            $email->text($payload['text']);
        }

        $replyTo = $payload['reply_to'] ?? $account->reply_to_address;

        if ($replyTo) {
            $email->replyTo($replyTo);
        }

        foreach ($payload['headers'] ?? [] as $name => $value) {
            $email->getHeaders()->addTextHeader($name, $value);
        }

        $lastException = null;

        foreach ($dsns as $dsn) {
            $transport = Transport::fromDsn($dsn);

            try {
                $sent = $transport->send($email);

                return [
                    'message_id' => $sent->getMessageId(),
                ];
            } catch (TransportExceptionInterface $exception) {
                $lastException = $exception;
            }
        }

        if ($lastException instanceof TransportExceptionInterface) {
            throw new RuntimeException($this->friendlyTransportMessage($lastException->getMessage()), previous: $lastException);
        }

        throw new RuntimeException('SMTP connection failed. Check the mailbox settings and try again.');
    }

    public function diagnostics(EmailAccount $account): array
    {
        if ($account->provider === 'php_mail') {
            return [
                'ready' => true,
                'host_resolves' => true,
                'effective_host' => 'native://default',
                'message' => 'PHP mail transport is active.',
            ];
        }

        $hosts = $this->resolveHostCandidates($account);
        $configuredHost = $this->normalizeHost($account->smtp_host);

        if ($hosts === []) {
            return [
                'ready' => false,
                'host_resolves' => false,
                'effective_host' => null,
                'message' => 'SMTP host does not resolve. Update the mailbox SMTP host and try again.',
            ];
        }

        $effectiveHost = $hosts[0];

        if ($configuredHost && $configuredHost === $effectiveHost) {
            return [
                'ready' => true,
                'host_resolves' => true,
                'effective_host' => $effectiveHost,
                'message' => 'SMTP host resolves and is ready for connection tests.',
            ];
        }

        return [
            'ready' => true,
            'host_resolves' => true,
            'effective_host' => $effectiveHost,
            'message' => "SMTP host '{$configuredHost}' did not resolve. The app will use '{$effectiveHost}' automatically.",
        ];
    }

    private function resolveDsns(EmailAccount $account): array
    {
        if ($account->provider === 'php_mail') {
            return ['native://default'];
        }

        $authSegment = '';

        if ($account->smtp_username) {
            $authSegment = rawurlencode((string) $account->smtp_username);

            if ($account->smtp_password) {
                $authSegment .= ':'.rawurlencode((string) $account->smtp_password);
            }

            $authSegment .= '@';
        }

        $query = http_build_query(array_filter([
            'encryption' => $account->smtp_encryption ?: null,
            'timeout' => max(3, (int) config('bulkmail.smtp_timeout_seconds', 8)),
        ]));

        return collect($this->resolveHostCandidates($account))
            ->map(fn (string $host) => sprintf(
                'smtp://%s%s:%s%s',
                $authSegment,
                $host,
                $account->smtp_port,
                $query !== '' ? '?'.$query : ''
            ))
            ->values()
            ->all();
    }

    private function normalizeHost(?string $host): ?string
    {
        $host = strtolower(trim((string) $host));

        if ($host === '') {
            return null;
        }

        $host = preg_replace('#^[a-z][a-z0-9+.-]*://#i', '', $host) ?? $host;
        $host = explode('/', $host, 2)[0];
        $host = explode(':', $host, 2)[0];
        $host = trim($host, " \t\n\r\0\x0B.");

        return $host !== '' ? $host : null;
    }

    private function isResolvableHost(string $host): bool
    {
        if (filter_var($host, FILTER_VALIDATE_IP)) {
            return true;
        }

        return gethostbyname($host) !== $host;
    }

    private function resolveHostCandidates(EmailAccount $account): array
    {
        $configuredHost = $this->normalizeHost($account->smtp_host);
        $domain = strtolower(trim((string) substr(strrchr($account->email_address, '@') ?: '', 1)));
        $candidates = [];

        if ($configuredHost && $this->isResolvableHost($configuredHost)) {
            $candidates[] = $configuredHost;
        }

        foreach ($this->commonMailHostsForDomain($domain) as $host) {
            if ($this->isResolvableHost($host)) {
                $candidates[] = $host;
            }
        }

        foreach ($this->mxHostsForDomain($domain) as $host) {
            if ($this->isResolvableHost($host)) {
                $candidates[] = $host;
            }
        }

        $candidates = array_values(array_unique(array_filter($candidates)));

        if ($configuredHost && $candidates !== [] && $configuredHost !== $candidates[0]) {
            Log::warning('SMTP host did not resolve, so a fallback mail host will be used.', [
                'email_account_id' => $account->id,
                'configured_host' => $configuredHost,
                'fallback_host' => $candidates[0],
                'email_address' => $account->email_address,
            ]);
        }

        return $candidates;
    }

    private function commonMailHostsForDomain(string $domain): array
    {
        if ($domain === '') {
            return [];
        }

        return [
            'smtp.'.$domain,
            'mail.'.$domain,
            'mx.'.$domain,
        ];
    }

    private function mxHostsForDomain(string $domain): array
    {
        if ($domain === '') {
            return [];
        }

        $records = dns_get_record($domain, DNS_MX);

        if (! is_array($records) || $records === []) {
            return [];
        }

        usort($records, fn (array $a, array $b) => ($a['pri'] ?? PHP_INT_MAX) <=> ($b['pri'] ?? PHP_INT_MAX));

        $hosts = [];

        foreach ($records as $record) {
            $target = $this->normalizeHost($record['target'] ?? null);

            if ($target) {
                $hosts[] = $target;
            }
        }

        return array_values(array_unique($hosts));
    }

    private function friendlyTransportMessage(string $message): string
    {
        $message = trim($message);

        if ($message === '') {
            return 'SMTP connection failed. Check the mailbox settings and try again.';
        }

        if (str_contains($message, 'Connection timed out')) {
            return 'SMTP connection timed out. Check the mailbox host, port, and firewall settings, then try again.';
        }

        if (str_contains($message, 'php_network_getaddresses') || str_contains($message, 'getaddrinfo')) {
            return 'SMTP host does not resolve. Update the mailbox SMTP host and try again.';
        }

        return $message;
    }
}
