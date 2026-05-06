<?php

namespace App\Console\Commands;

use App\Services\ReplySyncService;
use Illuminate\Console\Command;

class SyncReplies extends Command
{
    protected $signature = 'campaigns:sync-replies';

    protected $description = 'Sync inbound replies and bounce messages through IMAP.';

    public function handle(ReplySyncService $replySyncService): int
    {
        $count = $replySyncService->syncAll();
        $this->info("Synced {$count} inbound message(s).");

        return self::SUCCESS;
    }
}
