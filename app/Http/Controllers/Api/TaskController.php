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

        if ($task->assignee_id) {
            WorkspaceActions::notify([$task->assignee_id], 'New task assigned', "{$task->title} was assigned to you.", 'task', $task->getKey(), $project->id, ['projectId' => $project->id]);
        }

        return response()->json([
            'task' => WorkspacePresenter::task($task),
            'progress' => $progress,
        ], 201);
    }

    public function update(Request $request, Task $task): JsonResponse
    {
        $existing = WorkspaceAccess::taskOrFail($request->user(), $task->getKey());
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
        $existing->delete();

        WorkspaceActions::updateProjectProgress($projectId);
        WorkspaceActions::log($request->user()->getKey(), 'task.deleted', "{$request->user()->name} deleted task {$title}", 'task', $taskId, $projectId, $taskId);

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
