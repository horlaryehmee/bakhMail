<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AnalyticsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __construct(private readonly AnalyticsService $analyticsService)
    {
    }

    public function show(Request $request): JsonResponse
    {
        $user = $request->user();
        $summary = $this->analyticsService->summaryForUser($user);

        return response()->json([
            'stats' => [
                'contacts' => $user->contacts()->count(),
                'campaigns' => $user->campaigns()->count(),
                'email_accounts' => $user->emailAccounts()->count(),
                'replies_pending' => $user->unreadNotifications()->count(),
            ],
            'analytics' => $summary,
            'recent_campaigns' => $user->campaigns()->latest()->take(5)->get()->map(fn ($campaign) => [
                'id' => $campaign->id,
                'name' => $campaign->name,
                'status' => $campaign->status,
                'scheduled_at' => $campaign->scheduled_at?->toIso8601String(),
            ])->all(),
            'recent_activity' => $user->activityLogs()->latest('created_at')->take(10)->get()->map(fn ($entry) => [
                'id' => $entry->id,
                'action' => $entry->action,
                'description' => $entry->description,
                'created_at' => $entry->created_at?->toIso8601String(),
            ])->all(),
        ]);
    }
}
