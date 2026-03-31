<?php

use App\Support\WorkspaceMailer;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('workspace:send-deadline-reminders', function () {
    $count = app(WorkspaceMailer::class)->sendDeadlineDigests();

    $this->info("Sent {$count} deadline reminder email(s).");
})->purpose('Send deadline reminder emails to users with deadline notifications enabled.');

Artisan::command('workspace:test-email {email}', function (string $email) {
    $mailer = app(WorkspaceMailer::class);
    $config = $mailer->currentMailConfiguration();

    $this->line("Mailer: {$config['mailer']}");
    $this->line('Scheme: '.($config['scheme'] !== '' ? $config['scheme'] : 'not set'));
    $this->line('Host: '.($config['host'] !== '' ? $config['host'] : 'not set'));
    $this->line('Port: '.($config['port'] !== '' ? $config['port'] : 'not set'));
    $this->line('Username: '.($config['username'] !== '' ? $config['username'] : 'not set'));
    $this->line('From: '.($config['fromName'] !== '' ? "{$config['fromName']} <{$config['fromAddress']}>" : ($config['fromAddress'] !== '' ? $config['fromAddress'] : 'not set')));

    if ($config['mailer'] === 'log') {
        $this->warn('MAIL_MAILER is set to log, so this email will be written to logs instead of being delivered to an inbox.');
    }

    try {
        $mailer->sendTestMessage($email);
        $this->info("Test email dispatched for {$email}.");
    } catch (\Throwable $exception) {
        $this->error('Test email failed: '.$exception->getMessage());

        return self::FAILURE;
    }

    return self::SUCCESS;
})->purpose('Send a branded SMTP test email using the current live mail configuration.');
