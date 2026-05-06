<?php

namespace App\Console\Commands;

use App\Jobs\SendWarmupEmailJob;
use App\Models\EmailAccount;
use Illuminate\Console\Command;

class WarmupEmailAccounts extends Command
{
    protected $signature = 'campaigns:warmup';

    protected $description = 'Queue warm-up emails for enabled email accounts.';

    public function handle(): int
    {
        $count = 0;

        EmailAccount::query()
            ->where('status', 'active')
            ->where('warmup_enabled', true)
            ->each(function (EmailAccount $account) use (&$count): void {
                SendWarmupEmailJob::dispatch($account->id);
                $count++;
            });

        $this->info("Queued {$count} warm-up email(s).");

        return self::SUCCESS;
    }
}
