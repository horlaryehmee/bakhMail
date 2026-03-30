<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WorkspaceNotification;
use App\Support\WorkspacePresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $notifications = WorkspaceNotification::query()
            ->where('recipient_id', $request->user()->getKey())
            ->latest()
            ->take(50)
            ->get();

        return response()->json([
            'notifications' => $notifications->map(fn (WorkspaceNotification $notification) => WorkspacePresenter::notification($notification))->all(),
        ]);
    }

    public function markRead(Request $request, WorkspaceNotification $notification): JsonResponse
    {
        abort_unless((string) $notification->recipient_id === (string) $request->user()->getKey(), 404, 'Notification not found');
        $notification->update(['read_at' => now()]);

        return response()->json([
            'notification' => WorkspacePresenter::notification($notification->fresh()),
        ]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        WorkspaceNotification::query()
            ->where('recipient_id', $request->user()->getKey())
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json([], 204);
    }
}
