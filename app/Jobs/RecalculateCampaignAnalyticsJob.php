<?php

namespace App\Jobs;

use App\Models\Campaign;
use App\Services\AnalyticsService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class RecalculateCampaignAnalyticsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public readonly int $campaignId)
    {
    }

    public function handle(AnalyticsService $analyticsService): void
    {
        $campaign = Campaign::query()->find($this->campaignId);

        if ($campaign) {
            $analyticsService->refreshCampaign($campaign);
        }
    }
}
