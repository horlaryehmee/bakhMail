<?php

namespace App\Support;

use App\Models\ActivityLog;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use App\Models\WorkspaceNotification;
use Illuminate\Support\Collection;

class WorkspaceActions
{
    public static function log(?int $actorId, string $action, string $message, string $entityType, string|int $entityId, ?int $projectId = null, ?int $taskId = null, array $metadata = [], bool $demoData = false): void
    {
        ActivityLog::query()->create([
            'actor_id' => $actorId,
            'action' => $action,
            'message' => $message,
            'entity_type' => $entityType,
            'entity_id' => (string) $entityId,
            'project_id' => $projectId,
            'task_id' => $taskId,
            'metadata' => $metadata,
            'demo_data' => $demoData,
        ]);
    }

    public static function notify(array $recipientIds, string $title, string $message, string $entityType, string|int $entityId, ?int $projectId = null, array $metadata = [], bool $demoData = false): void
    {
        $unique = collect($recipientIds)->filter()->unique()->values();

        if ($unique->isEmpty()) {
            return;
        }

        $now = now();
        $records = $unique->map(fn ($recipientId) => [
            'recipient_id' => $recipientId,
            'title' => $title,
            'message' => $message,
            'entity_type' => $entityType,
            'entity_id' => (string) $entityId,
            'project_id' => $projectId,
            'metadata' => json_encode($metadata, JSON_THROW_ON_ERROR),
            'demo_data' => $demoData,
            'created_at' => $now,
            'updated_at' => $now,
        ])->all();

        WorkspaceNotification::query()->insert($records);
    }

    public static function updateProjectProgress(int $projectId): int
    {
        $project = Project::query()->withCount([
            'tasks',
            'tasks as completed_tasks_count' => fn ($query) => $query->where('status', 'completed'),
        ])->findOrFail($projectId);

        $progress = $project->tasks_count > 0
            ? (int) round(($project->completed_tasks_count / $project->tasks_count) * 100)
            : (int) $project->progress;

        $project->update(['progress' => $progress]);

        return $progress;
    }

    public static function collaboratorIds(Project $project): Collection
    {
        $project->loadMissing(['createdBy', 'teamMembers', 'clients']);

        return collect([
            $project->created_by_id,
            ...$project->teamMembers->pluck('id')->all(),
            ...$project->clients->pluck('id')->all(),
        ])->filter()->unique()->values();
    }
}
