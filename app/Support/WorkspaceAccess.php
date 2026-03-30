<?php

namespace App\Support;

use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class WorkspaceAccess
{
    public static function applyProjectScope(Builder $query, User $user): Builder
    {
        if (in_array($user->role, ['master_admin', 'admin'], true)) {
            return $query;
        }

        return $query->whereHas('clients', fn (Builder $builder) => $builder->whereKey($user->getKey()));
    }

    public static function projectIdsFor(User $user): array
    {
        return static::applyProjectScope(Project::query(), $user)->pluck('id')->all();
    }

    public static function projectOrFail(User $user, string|int $projectId): Project
    {
        $project = static::applyProjectScope(
            Project::query()->with(['createdBy', 'teamMembers', 'clients']),
            $user
        )->find($projectId);

        if (! $project) {
            throw new NotFoundHttpException('Project not found');
        }

        return $project;
    }

    public static function taskOrFail(User $user, string|int $taskId): Task
    {
        $task = Task::query()
            ->with(['project', 'assignee', 'reporter'])
            ->whereKey($taskId)
            ->whereIn('project_id', static::projectIdsFor($user))
            ->first();

        if (! $task) {
            throw new NotFoundHttpException('Task not found');
        }

        return $task;
    }

    public static function ensureTaskMatchesProject(Task $task, string|int $projectId): void
    {
        if ((string) $task->project_id !== (string) $projectId) {
            throw ValidationException::withMessages([
                'task' => 'Task does not belong to the selected project.',
            ]);
        }
    }
}
