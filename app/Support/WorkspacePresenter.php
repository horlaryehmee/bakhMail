<?php

namespace App\Support;

use App\Models\ActivityLog;
use App\Models\BrandingSetting;
use App\Models\Comment;
use App\Models\Invite;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use App\Models\WorkspaceNotification;
use App\Models\WorkspaceRequest;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class WorkspacePresenter
{
    public static function defaultNotificationPreferences(): array
    {
        return [
            'comments' => true,
            'requests' => true,
            'deadlines' => true,
            'activity' => true,
        ];
    }

    public static function branding(?BrandingSetting $branding): array
    {
        $logoUrl = trim((string) ($branding?->logo_url ?? ''));

        if ($logoUrl !== '' && ! Str::startsWith($logoUrl, ['http://', 'https://', 'data:', '/'])) {
            $logoUrl = '/' . ltrim($logoUrl, '/');
        }

        return [
            'brandName' => trim($branding?->brand_name ?: 'Bakhtech Solutions'),
            'logoUrl' => $logoUrl,
            'logoSize' => (float) ($branding?->logo_size ?: 1),
            'logoVersion' => optional($branding?->updated_at)?->timestamp ? (string) $branding->updated_at->timestamp : '',
        ];
    }

    public static function user(?User $user, bool $includeEmail = true): ?array
    {
        if (! $user) {
            return null;
        }

        return [
            '_id' => (string) $user->getKey(),
            'id' => (string) $user->getKey(),
            'name' => (string) $user->name,
            'email' => $includeEmail ? (string) $user->email : '',
            'role' => (string) $user->role,
            'title' => (string) ($user->title ?? ''),
            'avatarUrl' => (string) ($user->avatar_url ?? ''),
            'isActive' => (bool) $user->is_active,
            'notificationPreferences' => array_merge(static::defaultNotificationPreferences(), $user->notification_preferences ?? []),
        ];
    }

    public static function project(Project $project, ?int $taskCount = null, ?int $completedTaskCount = null): array
    {
        return [
            '_id' => (string) $project->getKey(),
            'id' => (string) $project->getKey(),
            'name' => (string) $project->name,
            'summary' => (string) ($project->summary ?? ''),
            'description' => (string) ($project->description ?? ''),
            'status' => (string) $project->status,
            'priority' => (string) $project->priority,
            'type' => (string) ($project->type ?? ''),
            'tags' => array_values($project->tags ?? []),
            'progress' => (int) $project->progress,
            'startDate' => optional($project->start_date)?->toIso8601String(),
            'deadline' => optional($project->deadline)?->toIso8601String(),
            'previewType' => (string) ($project->preview_type ?? 'none'),
            'previewUrl' => (string) ($project->preview_url ?? ''),
            'previewImageUrl' => (string) ($project->preview_image_url ?? ''),
            'previewVideoUrl' => (string) ($project->preview_video_url ?? ''),
            'attachments' => array_values($project->attachments ?? []),
            'teamMembers' => $project->relationLoaded('teamMembers')
                ? $project->teamMembers->map(fn (User $user) => static::user($user))->all()
                : [],
            'clients' => $project->relationLoaded('clients')
                ? $project->clients->map(fn (User $user) => static::user($user))->all()
                : [],
            'createdBy' => $project->relationLoaded('createdBy') ? static::user($project->createdBy) : null,
            'taskCount' => $taskCount,
            'completedTaskCount' => $completedTaskCount,
            'createdAt' => optional($project->created_at)?->toIso8601String(),
        ];
    }

    public static function task(Task $task): array
    {
        $projectValue = $task->relationLoaded('project') && $task->project
            ? [
                '_id' => (string) $task->project->getKey(),
                'id' => (string) $task->project->getKey(),
                'name' => (string) $task->project->name,
                'status' => (string) $task->project->status,
                'priority' => (string) $task->project->priority,
                'progress' => (int) $task->project->progress,
            ]
            : (string) $task->project_id;

        return [
            '_id' => (string) $task->getKey(),
            'id' => (string) $task->getKey(),
            'title' => (string) $task->title,
            'description' => (string) ($task->description ?? ''),
            'status' => (string) $task->status,
            'priority' => (string) $task->priority,
            'milestone' => (bool) $task->milestone,
            'order' => (int) $task->order,
            'tags' => array_values($task->tags ?? []),
            'startDate' => optional($task->start_date)?->toIso8601String(),
            'dueDate' => optional($task->due_date)?->toIso8601String(),
            'assignee' => $task->relationLoaded('assignee') ? static::user($task->assignee) : null,
            'reporter' => $task->relationLoaded('reporter') ? static::user($task->reporter) : null,
            'project' => $projectValue,
            'subtasks' => array_values($task->subtasks ?? []),
            'attachments' => array_values($task->attachments ?? []),
            'createdAt' => optional($task->created_at)?->toIso8601String(),
        ];
    }

    public static function comment(Comment $comment): array
    {
        return [
            '_id' => (string) $comment->getKey(),
            'id' => (string) $comment->getKey(),
            'content' => (string) ($comment->content ?? ''),
            'project' => (string) $comment->project_id,
            'task' => $comment->task_id ? (string) $comment->task_id : null,
            'replyTo' => $comment->relationLoaded('replyTo') && $comment->replyTo ? static::commentReference($comment->replyTo) : null,
            'author' => $comment->relationLoaded('author') ? static::user($comment->author) : null,
            'mentions' => $comment->relationLoaded('mentions')
                ? $comment->mentions->map(fn (User $user) => static::user($user))->all()
                : [],
            'attachments' => array_values($comment->attachments ?? []),
            'createdAt' => optional($comment->created_at)?->toIso8601String(),
        ];
    }

    public static function request(WorkspaceRequest $request): array
    {
        return [
            '_id' => (string) $request->getKey(),
            'id' => (string) $request->getKey(),
            'title' => (string) $request->title,
            'description' => (string) $request->description,
            'status' => (string) $request->status,
            'priority' => (string) $request->priority,
            'type' => (string) $request->type,
            'project' => $request->relationLoaded('project') && $request->project
                ? ['_id' => (string) $request->project->getKey(), 'id' => (string) $request->project->getKey(), 'name' => (string) $request->project->name]
                : (string) $request->project_id,
            'task' => $request->relationLoaded('task') && $request->task
                ? ['_id' => (string) $request->task->getKey(), 'id' => (string) $request->task->getKey(), 'title' => (string) $request->task->title]
                : ($request->task_id ? (string) $request->task_id : null),
            'sourceComment' => $request->relationLoaded('sourceComment') && $request->sourceComment
                ? static::commentReference($request->sourceComment)
                : null,
            'createdBy' => $request->relationLoaded('createdBy') ? static::user($request->createdBy) : null,
            'attachments' => array_values($request->attachments ?? []),
            'createdAt' => optional($request->created_at)?->toIso8601String(),
        ];
    }

    public static function notification(WorkspaceNotification $notification): array
    {
        return [
            '_id' => (string) $notification->getKey(),
            'id' => (string) $notification->getKey(),
            'title' => (string) $notification->title,
            'message' => (string) $notification->message,
            'entityType' => (string) $notification->entity_type,
            'entityId' => (string) $notification->entity_id,
            'readAt' => optional($notification->read_at)?->toIso8601String(),
            'createdAt' => optional($notification->created_at)?->toIso8601String(),
        ];
    }

    public static function activity(ActivityLog $activity): array
    {
        return [
            '_id' => (string) $activity->getKey(),
            'id' => (string) $activity->getKey(),
            'action' => (string) $activity->action,
            'message' => (string) $activity->message,
            'entityType' => (string) $activity->entity_type,
            'entityId' => (string) $activity->entity_id,
            'actor' => $activity->relationLoaded('actor') ? static::user($activity->actor) : null,
            'project' => $activity->project_id ? (string) $activity->project_id : null,
            'task' => $activity->task_id ? (string) $activity->task_id : null,
            'createdAt' => optional($activity->created_at)?->toIso8601String(),
        ];
    }

    public static function invite(Invite $invite, string $clientUrl): array
    {
        return [
            'id' => (string) $invite->getKey(),
            'email' => (string) $invite->email,
            'role' => (string) $invite->role,
            'inviteLink' => rtrim($clientUrl, '/') . '/?invite=' . $invite->token,
            'expiresAt' => optional($invite->expires_at)?->toIso8601String(),
            'createdAt' => optional($invite->created_at)?->toIso8601String(),
        ];
    }

    public static function summary(array $stats, Collection $projects, Collection $tasks, Collection $requests, Collection $activities): array
    {
        $projectsByStatus = collect(['not_started', 'in_progress', 'completed'])
            ->map(fn (string $status) => [
                'status' => $status,
                'count' => $projects->where('status', $status)->count(),
            ])
            ->values()
            ->all();

        $workload = $tasks
            ->filter(fn (Task $task) => $task->assignee)
            ->groupBy('assignee_id')
            ->map(function (Collection $group): array {
                /** @var Task $task */
                $task = $group->first();

                return [
                    'name' => (string) $task->assignee?->name,
                    'openTasks' => $group->where('status', '!=', 'completed')->count(),
                    'completedTasks' => $group->where('status', 'completed')->count(),
                ];
            })
            ->values()
            ->all();

        return [
            'stats' => $stats,
            'projectsByStatus' => $projectsByStatus,
            'workload' => $workload,
            'upcomingDeadlines' => $tasks
                ->filter(fn (Task $task) => $task->due_date && $task->status !== 'completed')
                ->sortBy('due_date')
                ->take(10)
                ->map(fn (Task $task) => static::task($task))
                ->values()
                ->all(),
            'recentActivity' => $activities
                ->map(fn (ActivityLog $activity) => static::activity($activity))
                ->values()
                ->all(),
        ];
    }

    private static function commentReference(Comment $comment): array
    {
        return [
            '_id' => (string) $comment->getKey(),
            'id' => (string) $comment->getKey(),
            'content' => (string) ($comment->content ?? ''),
            'task' => $comment->task_id ? (string) $comment->task_id : null,
            'createdAt' => optional($comment->created_at)?->toIso8601String(),
            'author' => $comment->relationLoaded('author') ? static::user($comment->author) : null,
            'attachments' => array_values($comment->attachments ?? []),
        ];
    }
}
