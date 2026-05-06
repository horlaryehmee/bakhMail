<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AnalyticsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class DashboardController extends Controller
{
    public function __construct(private readonly AnalyticsService $analyticsService)
    {
    }

    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        $summary = $this->analyticsService->summaryForUser($user);
        $hasContacts = Schema::hasTable('contacts');
        $hasCampaigns = Schema::hasTable('campaigns');
        $hasEmailAccounts = Schema::hasTable('email_accounts');
        $hasNotifications = Schema::hasTable('notifications')
            && Schema::hasColumns('notifications', ['id', 'type', 'notifiable_type', 'notifiable_id', 'data']);
        $hasActivityLogs = Schema::hasTable('activity_logs')
            && Schema::hasColumns('activity_logs', ['user_id', 'action', 'created_at']);

        return response()->json([
            'stats' => [
                'contacts' => $hasContacts ? $user->contacts()->count() : 0,
                'campaigns' => $hasCampaigns ? $user->campaigns()->count() : 0,
                'email_accounts' => $hasEmailAccounts ? $user->emailAccounts()->count() : 0,
                'replies_pending' => $hasNotifications ? $user->unreadNotifications()->count() : 0,
            ],
            'analytics' => $summary,
            'recent_campaigns' => ($hasCampaigns ? $user->campaigns()->latest()->take(5)->get() : collect())->map(fn ($campaign) => [
                'id' => $campaign->id,
                'name' => $campaign->name,
                'subject' => $campaign->subject,
                'status' => $campaign->status,
                'scheduled_at' => $campaign->scheduled_at?->toIso8601String(),
            ])->all(),
            'recent_activity' => ($hasActivityLogs ? $user->activityLogs()->latest('created_at')->take(10)->get() : collect())->map(fn ($entry) => [
                'id' => $entry->id,
                'action' => $entry->action,
                'description' => $entry->description,
                'created_at' => $entry->created_at?->toIso8601String(),
            ])->all(),
        ]);
    }
}
