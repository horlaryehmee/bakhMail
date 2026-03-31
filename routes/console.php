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
