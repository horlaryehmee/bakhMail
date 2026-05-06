<?php

namespace App\Console\Commands;

use App\Services\CampaignOrchestrator;
use Illuminate\Console\Command;

class DispatchScheduledCampaigns extends Command
{
    protected $signature = 'campaigns:dispatch';

    protected $description = 'Dispatch scheduled campaigns whose send time has arrived.';

    public function handle(CampaignOrchestrator $orchestrator): int
    {
        $count = $orchestrator->dispatchDueCampaigns();
        $this->info("Dispatched {$count} campaign(s).");

        return self::SUCCESS;
    }
}
