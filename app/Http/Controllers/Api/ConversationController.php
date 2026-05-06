<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ConversationThread;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConversationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $threads = ConversationThread::query()
            ->where('user_id', $request->user()->id)
            ->with(['contact', 'campaign', 'emailLogs' => fn ($query) => $query->latest()->limit(3)])
            ->orderByDesc('last_message_at')
            ->get();

        return response()->json([
            'data' => $threads->map(fn (ConversationThread $thread) => [
                'id' => $thread->id,
                'subject' => $thread->subject,
                'status' => $thread->status,
                'last_message_at' => $thread->last_message_at?->toIso8601String(),
                'contact' => [
                    'id' => $thread->contact?->id,
                    'name' => $thread->contact?->full_name,
                    'email' => $thread->contact?->email,
                ],
                'campaign' => $thread->campaign ? ['id' => $thread->campaign->id, 'name' => $thread->campaign->name] : null,
                'messages' => $thread->emailLogs->map(fn ($log) => [
                    'id' => $log->id,
                    'direction' => $log->direction,
                    'event_type' => $log->event_type,
                    'subject' => $log->subject,
                    'body_preview' => $log->body_preview,
                    'sent_at' => $log->sent_at?->toIso8601String(),
                ])->all(),
            ])->all(),
        ]);
    }

    public function show(Request $request, ConversationThread $thread): JsonResponse
    {
        abort_unless($thread->user_id === $request->user()->id, 404);
        $thread->load(['contact', 'campaign', 'emailLogs' => fn ($query) => $query->latest()->limit(50)]);

        return response()->json([
            'data' => [
                'id' => $thread->id,
                'subject' => $thread->subject,
                'status' => $thread->status,
                'contact' => [
                    'id' => $thread->contact?->id,
                    'name' => $thread->contact?->full_name,
                    'email' => $thread->contact?->email,
                ],
                'campaign' => $thread->campaign ? ['id' => $thread->campaign->id, 'name' => $thread->campaign->name] : null,
                'messages' => $thread->emailLogs->map(fn ($log) => [
                    'id' => $log->id,
                    'direction' => $log->direction,
                    'event_type' => $log->event_type,
                    'subject' => $log->subject,
                    'body_preview' => $log->body_preview,
                    'sender_email' => $log->sender_email,
                    'recipient_email' => $log->recipient_email,
                    'sent_at' => $log->sent_at?->toIso8601String(),
                ])->all(),
            ],
        ]);
    }
}
