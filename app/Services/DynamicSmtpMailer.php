<?php

namespace App\Services;

use App\Models\EmailAccount;
use RuntimeException;
use Symfony\Component\Mailer\Transport;
use Symfony\Component\Mailer\Exception\TransportExceptionInterface;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;

class DynamicSmtpMailer
{
    public function send(EmailAccount $account, array $payload): array
    {
        $dsn = $this->resolveDsn($account);

        if (! $dsn) {
            throw new RuntimeException('SMTP settings are incomplete for this account.');
        }

        $transport = Transport::fromDsn($dsn);
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

        try {
            $sent = $transport->send($email);
        } catch (TransportExceptionInterface $exception) {
            throw new RuntimeException($this->friendlyTransportMessage($exception->getMessage()), previous: $exception);
        }

        return [
            'message_id' => $sent->getMessageId(),
        ];
    }

    private function resolveDsn(EmailAccount $account): ?string
    {
        if ($account->provider === 'php_mail') {
            return 'native://default';
        }

        $host = $this->normalizeHost($account->smtp_host);

        if (! $host || ! $account->smtp_port) {
            return null;
        }

        if (! $this->isResolvableHost($host)) {
            throw new RuntimeException('SMTP host does not resolve. Update the mailbox SMTP host and try again.');
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

        return sprintf(
            'smtp://%s%s:%s%s',
            $authSegment,
            $host,
            $account->smtp_port,
            $query !== '' ? '?'.$query : ''
        );
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
