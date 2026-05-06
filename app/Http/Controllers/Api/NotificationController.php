<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $request->user()->notifications()->latest()->take(25)->get()->map(fn (DatabaseNotification $notification) => [
                'id' => $notification->id,
                'read_at' => $notification->read_at?->toIso8601String(),
                'title' => $notification->data['title'] ?? 'Notification',
                'message' => $notification->data['message'] ?? '',
                'level' => $notification->data['level'] ?? 'info',
                'meta' => $notification->data['meta'] ?? [],
                'created_at' => $notification->created_at?->toIso8601String(),
            ])->all(),
        ]);
    }

    public function markRead(Request $request, DatabaseNotification $notification): JsonResponse
    {
        abort_unless($notification->notifiable_id === $request->user()->id, 404);
        $notification->markAsRead();

        return response()->json(['status' => 'read']);
    }
}
