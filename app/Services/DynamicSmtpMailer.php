<?php

namespace App\Services;

use App\Models\EmailAccount;
use RuntimeException;
use Symfony\Component\Mailer\Transport;
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

        $sent = $transport->send($email);

        return [
            'message_id' => $sent->getMessageId(),
        ];
    }

    private function resolveDsn(EmailAccount $account): ?string
    {
        if ($account->provider === 'php_mail') {
            return 'native://default';
        }

        if (! $account->smtp_host || ! $account->smtp_port) {
            return null;
        }

        $authSegment = '';

        if ($account->smtp_username) {
            $authSegment = rawurlencode((string) $account->smtp_username);

            if ($account->smtp_password) {
                $authSegment .= ':'.rawurlencode((string) $account->smtp_password);
            }

            $authSegment .= '@';
        }

        return sprintf(
            'smtp://%s%s:%s%s',
            $authSegment,
            $account->smtp_host,
            $account->smtp_port,
            $account->smtp_encryption ? '?encryption='.$account->smtp_encryption : ''
        );
    }
}
