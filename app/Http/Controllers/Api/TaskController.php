<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Task;
use App\Models\User;
use App\Support\WorkspaceAccess;
use App\Support\WorkspaceActions;
use App\Support\WorkspacePresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class TaskController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tasks = Task::query()
            ->with(['project', 'assignee', 'reporter'])
            ->whereIn('project_id', WorkspaceAccess::projectIdsFor($request->user()))
            ->when($request->filled('projectId'), fn ($query) => $query->where('project_id', $request->query('projectId')))
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->query('status')))
            ->when($request->filled('priority'), fn ($query) => $query->where('priority', $request->query('priority')))
            ->when($request->filled('assignee'), fn ($query) => $query->where('assignee_id', $request->query('assignee')))
            ->when($request->filled('search'), function ($query) use ($request): void {
                $search = trim((string) $request->query('search'));
                $query->where(function ($builder) use ($search): void {
                    $builder->where('title', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%");
                });
            })
            ->orderBy('due_date')
            ->orderBy('order')
            ->latest('created_at')
            ->get();

        return response()->json([
            'tasks' => $tasks->map(fn (Task $task) => WorkspacePresenter::task($task))->all(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $payload = $this->validatePayload($request);
        $project = WorkspaceAccess::projectOrFail($request->user(), $payload['project']);
        $this->ensureAssigneeExists($payload['assignee'] ?? null);

        $task = Task::query()->create([
            'project_id' => $project->getKey(),
            'title' => $payload['title'],
            'description' => $payload['description'] ?? '',
            'status' => $payload['status'] ?? 'todo',
            'priority' => $payload['priority'] ?? 'medium',
            'assignee_id' => $payload['assignee'] ?? null,
            'reporter_id' => $request->user()->getKey(),
            'start_date' => $payload['startDate'] ?? null,
            'due_date' => $payload['dueDate'] ?? null,
            'milestone' => $payload['milestone'] ?? false,
            'order' => $payload['order'] ?? 0,
            'tags' => array_values($payload['tags'] ?? []),
            'subtasks' => array_values($payload['subtasks'] ?? []),
            'attachments' => array_values($payload['attachments'] ?? []),
        ]);
        $task->load(['project', 'assignee', 'reporter']);

        $progress = WorkspaceActions::updateProjectProgress($project->id);
        WorkspaceActions::log($request->user()->getKey(), 'task.created', "{$request->user()->name} created task {$task->title}", 'task', $task->getKey(), $project->id, $task->id);

        $activityRecipients = WorkspaceActions::collaboratorIds($project)
            ->reject(fn ($id) => (string) $id === (string) $request->user()->getKey())
            ->reject(fn ($id) => $task->assignee_id && (string) $id === (string) $task->assignee_id)
            ->all();

        WorkspaceActions::notify(
            $activityRecipients,
            'Task created',
            "{$request->user()->name} created {$task->title} in {$project->name}.",
            'task',
            $task->getKey(),
            $project->id,
            [
                'actorName' => $request->user()->name,
                'projectName' => $project->name,
                'taskTitle' => $task->title,
                'priority' => str($task->priority)->replace('_', ' ')->title()->toString(),
                'dueDate' => optional($task->due_date)?->format('M j, Y'),
            ],
            false,
            'activity',
            (int) $request->user()->getKey(),
        );

        if ($task->assignee_id) {
            WorkspaceActions::notify(
                [$task->assignee_id],
                'New task assigned',
                "{$task->title} was assigned to you.",
                'task',
                $task->getKey(),
                $project->id,
                [
                    'actorName' => $request->user()->name,
                    'projectName' => $project->name,
                    'taskTitle' => $task->title,
                    'priority' => str($task->priority)->replace('_', ' ')->title()->toString(),
                    'dueDate' => optional($task->due_date)?->format('M j, Y'),
                ],
                false,
                $task->due_date ? 'deadlines' : 'activity',
                (int) $request->user()->getKey(),
            );
        }

        return response()->json([
            'task' => WorkspacePresenter::task($task),
            'progress' => $progress,
        ], 201);
    }

    public function update(Request $request, Task $task): JsonResponse
    {
        $existing = WorkspaceAccess::taskOrFail($request->user(), $task->getKey());
        $previousAssigneeId = $existing->assignee_id;
        $previousStatus = $existing->status;
        $previousDueDate = $existing->due_date?->copy();
        $payload = $this->validatePayload($request, true);
        $targetProjectId = array_key_exists('project', $payload) ? $payload['project'] : $existing->project_id;

        if (array_key_exists('project', $payload)) {
            WorkspaceAccess::projectOrFail($request->user(), $payload['project']);
        }

        $this->ensureAssigneeExists($payload['assignee'] ?? null);

        $existing->update([
            ...(array_key_exists('project', $payload) ? ['project_id' => $payload['project']] : []),
            ...(array_key_exists('title', $payload) ? ['title' => $payload['title']] : []),
            ...(array_key_exists('description', $payload) ? ['description' => $payload['description'] ?? ''] : []),
            ...(array_key_exists('status', $payload) ? ['status' => $payload['status']] : []),
            ...(array_key_exists('priority', $payload) ? ['priority' => $payload['priority']] : []),
            ...(array_key_exists('assignee', $payload) ? ['assignee_id' => $payload['assignee'] ?: null] : []),
            ...(array_key_exists('startDate', $payload) ? ['start_date' => $payload['startDate'] ?: null] : []),
            ...(array_key_exists('dueDate', $payload) ? ['due_date' => $payload['dueDate'] ?: null] : []),
            ...(array_key_exists('milestone', $payload) ? ['milestone' => $payload['milestone']] : []),
            ...(array_key_exists('order', $payload) ? ['order' => $payload['order']] : []),
            ...(array_key_exists('tags', $payload) ? ['tags' => array_values($payload['tags'] ?? [])] : []),
            ...(array_key_exists('subtasks', $payload) ? ['subtasks' => array_values($payload['subtasks'] ?? [])] : []),
            ...(array_key_exists('attachments', $payload) ? ['attachments' => array_values($payload['attachments'] ?? [])] : []),
        ]);
        $existing->load(['project', 'assignee', 'reporter']);

        $progress = WorkspaceActions::updateProjectProgress((int) $targetProjectId);
        if ((string) $targetProjectId !== (string) $task->project_id) {
            WorkspaceActions::updateProjectProgress((int) $task->project_id);
        }

        WorkspaceActions::log($request->user()->getKey(), 'task.updated', "{$request->user()->name} updated task {$existing->title}", 'task', $existing->getKey(), (int) $targetProjectId, $existing->id);

        $projectName = $existing->project?->name ?? 'Project workspace';
        $activityRecipients = WorkspaceActions::collaboratorIds($existing->project)
            ->reject(fn ($id) => (string) $id === (string) $request->user()->getKey())
            ->reject(fn ($id) => $existing->assignee_id && (string) $id === (string) $existing->assignee_id)
            ->all();

        WorkspaceActions::notify(
            $activityRecipients,
            'Task updated',
            "{$request->user()->name} updated {$existing->title}.",
            'task',
            $existing->getKey(),
            (int) $targetProjectId,
            [
                'actorName' => $request->user()->name,
                'projectName' => $projectName,
                'taskTitle' => $existing->title,
                'status' => str($existing->status)->replace('_', ' ')->title()->toString(),
                'priority' => str($existing->priority)->replace('_', ' ')->title()->toString(),
                'dueDate' => optional($existing->due_date)?->format('M j, Y'),
            ],
            false,
            'activity',
            (int) $request->user()->getKey(),
        );

        if ($existing->assignee_id && (string) $previousAssigneeId !== (string) $existing->assignee_id) {
            WorkspaceActions::notify(
                [$existing->assignee_id],
                'Task assigned to you',
                "{$existing->title} is now assigned to you.",
                'task',
                $existing->getKey(),
                (int) $targetProjectId,
                [
                    'actorName' => $request->user()->name,
                    'projectName' => $projectName,
                    'taskTitle' => $existing->title,
                    'priority' => str($existing->priority)->replace('_', ' ')->title()->toString(),
                    'dueDate' => optional($existing->due_date)?->format('M j, Y'),
                ],
                false,
                $existing->due_date ? 'deadlines' : 'activity',
                (int) $request->user()->getKey(),
            );
        }

        if ((string) optional($previousDueDate)?->toDateString() !== (string) optional($existing->due_date)?->toDateString() && $existing->due_date) {
            $deadlineRecipients = collect([$existing->assignee_id, $existing->reporter_id])
                ->filter()
                ->reject(fn ($id) => (string) $id === (string) $request->user()->getKey())
                ->unique()
                ->values()
                ->all();

            WorkspaceActions::notify(
                $deadlineRecipients,
                'Task due date changed',
                "{$existing->title} is now due on {$existing->due_date->format('M j, Y')}.",
                'task',
                $existing->getKey(),
                (int) $targetProjectId,
                [
                    'actorName' => $request->user()->name,
                    'projectName' => $projectName,
                    'taskTitle' => $existing->title,
                    'dueDate' => $existing->due_date->format('M j, Y'),
                ],
                false,
                'deadlines',
                (int) $request->user()->getKey(),
            );
        }

        if ($previousStatus !== $existing->status) {
            $statusRecipients = collect([$existing->assignee_id, $existing->reporter_id])
                ->filter()
                ->reject(fn ($id) => (string) $id === (string) $request->user()->getKey())
                ->unique()
                ->values()
                ->all();

            WorkspaceActions::notify(
                $statusRecipients,
                'Task status changed',
                "{$existing->title} moved to " . str($existing->status)->replace('_', ' ')->title()->toString() . '.',
                'task',
                $existing->getKey(),
                (int) $targetProjectId,
                [
                    'actorName' => $request->user()->name,
                    'projectName' => $projectName,
                    'taskTitle' => $existing->title,
                    'status' => str($existing->status)->replace('_', ' ')->title()->toString(),
                ],
                false,
                'activity',
                (int) $request->user()->getKey(),
            );
        }

        return response()->json([
            'task' => WorkspacePresenter::task($existing),
            'progress' => $progress,
        ]);
    }

    public function updateStatus(Request $request, Task $task): JsonResponse
    {
        $existing = WorkspaceAccess::taskOrFail($request->user(), $task->getKey());
        $payload = $request->validate([
            'status' => ['required', Rule::in(['todo', 'in_progress', 'review', 'completed'])],
            'order' => ['sometimes', 'integer', 'min:0', 'max:10000'],
        ]);

        $existing->update([
            'status' => $payload['status'],
            ...(array_key_exists('order', $payload) ? ['order' => $payload['order']] : []),
        ]);
        $existing->load(['project', 'assignee', 'reporter']);

        $progress = WorkspaceActions::updateProjectProgress((int) $existing->project_id);
        WorkspaceActions::log($request->user()->getKey(), 'task.status_changed', "{$request->user()->name} moved {$existing->title} to {$payload['status']}", 'task', $existing->getKey(), (int) $existing->project_id, $existing->id);

        $statusRecipients = collect([
            $existing->assignee_id,
            $existing->reporter_id,
            ...WorkspaceActions::collaboratorIds($existing->project)->all(),
        ])
            ->filter()
            ->reject(fn ($id) => (string) $id === (string) $request->user()->getKey())
            ->unique()
            ->values()
            ->all();

        WorkspaceActions::notify(
            $statusRecipients,
            'Task status changed',
            "{$existing->title} moved to " . str($payload['status'])->replace('_', ' ')->title()->toString() . '.',
            'task',
            $existing->getKey(),
            (int) $existing->project_id,
            [
                'actorName' => $request->user()->name,
                'projectName' => $existing->project?->name ?? 'Project workspace',
                'taskTitle' => $existing->title,
                'status' => str($payload['status'])->replace('_', ' ')->title()->toString(),
            ],
            false,
            'activity',
            (int) $request->user()->getKey(),
        );

        return response()->json([
            'task' => WorkspacePresenter::task($existing),
            'progress' => $progress,
        ]);
    }

    public function destroy(Request $request, Task $task): JsonResponse
    {
        $existing = WorkspaceAccess::taskOrFail($request->user(), $task->getKey());
        $projectId = (int) $existing->project_id;
        $title = $existing->title;
        $taskId = $existing->id;
        $projectName = $existing->project?->name ?? 'Project workspace';
        $recipients = collect([
            $existing->assignee_id,
            $existing->reporter_id,
            ...WorkspaceActions::collaboratorIds($existing->project)->all(),
        ])
            ->filter()
            ->reject(fn ($id) => (string) $id === (string) $request->user()->getKey())
            ->unique()
            ->values()
            ->all();
        $existing->delete();

        WorkspaceActions::updateProjectProgress($projectId);
        WorkspaceActions::log($request->user()->getKey(), 'task.deleted', "{$request->user()->name} deleted task {$title}", 'task', $taskId, $projectId, $taskId);
        WorkspaceActions::notify(
            $recipients,
            'Task removed',
            "{$title} was removed from {$projectName}.",
            'task',
            $taskId,
            $projectId,
            [
                'actorName' => $request->user()->name,
                'projectName' => $projectName,
                'taskTitle' => $title,
            ],
            false,
            'activity',
            (int) $request->user()->getKey(),
        );

        return response()->json([], 204);
    }

    private function validatePayload(Request $request, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'project' => [$required, 'string'],
            'title' => [$required, 'string', 'min:2', 'max:140'],
            'description' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'status' => ['sometimes', Rule::in(['todo', 'in_progress', 'review', 'completed'])],
            'priority' => ['sometimes', Rule::in(['low', 'medium', 'high', 'urgent'])],
            'assignee' => ['sometimes', 'nullable', 'string'],
            'startDate' => ['sometimes', 'nullable', 'date'],
            'dueDate' => ['sometimes', 'nullable', 'date'],
            'milestone' => ['sometimes', 'boolean'],
            'order' => ['sometimes', 'integer', 'min:0', 'max:10000'],
            'tags' => ['sometimes', 'array', 'max:20'],
            'tags.*' => ['string', 'max:40'],
            'subtasks' => ['sometimes', 'array', 'max:40'],
            'subtasks.*.title' => ['required_with:subtasks', 'string', 'min:1', 'max:140'],
            'subtasks.*.completed' => ['sometimes', 'boolean'],
            'subtasks.*.assignee' => ['sometimes', 'nullable', 'string'],
            'attachments' => ['sometimes', 'array', 'max:10'],
            'attachments.*.name' => ['required_with:attachments', 'string', 'min:1', 'max:180'],
            'attachments.*.url' => ['required_with:attachments', 'string'],
            'attachments.*.size' => ['required_with:attachments', 'integer', 'min:1', 'max:15728640'],
            'attachments.*.mimeType' => ['required_with:attachments', 'string', 'min:3', 'max:120'],
            'attachments.*.uploadedBy' => ['required_with:attachments', 'string'],
            'attachments.*.uploadedAt' => ['sometimes', 'string'],
        ]);
    }

    private function ensureAssigneeExists(?string $assigneeId): void
    {
        if (! $assigneeId) {
            return;
        }

        if (! User::query()->whereKey($assigneeId)->exists()) {
            throw ValidationException::withMessages([
                'assignee' => 'Assignee is invalid.',
            ]);
        }
    }
}
