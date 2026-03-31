<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Comment;
use App\Models\WorkspaceRequest;
use App\Support\WorkspaceAccess;
use App\Support\WorkspaceActions;
use App\Support\WorkspacePresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class RequestController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $requests = WorkspaceRequest::query()
            ->with(['project', 'task', 'sourceComment.author', 'createdBy'])
            ->whereIn('project_id', WorkspaceAccess::projectIdsFor($request->user()))
            ->when($request->filled('projectId'), fn ($query) => $query->where('project_id', $request->query('projectId')))
            ->latest()
            ->get();

        return response()->json([
            'requests' => $requests->map(fn (WorkspaceRequest $requestItem) => WorkspacePresenter::request($requestItem))->all(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $payload = $this->validatePayload($request);
        $project = WorkspaceAccess::projectOrFail($request->user(), $payload['project']);
        $task = ! empty($payload['task']) ? WorkspaceAccess::taskOrFail($request->user(), $payload['task']) : null;

        if ($task) {
            WorkspaceAccess::ensureTaskMatchesProject($task, $project->id);
        }

        $sourceComment = ! empty($payload['sourceComment'])
            ? Comment::query()->findOrFail($payload['sourceComment'])
            : null;

        if ($sourceComment && (string) $sourceComment->project_id !== (string) $project->id) {
            throw ValidationException::withMessages([
                'sourceComment' => 'Source message must belong to the selected project.',
            ]);
        }

        $requestItem = WorkspaceRequest::query()->create([
            'project_id' => $project->id,
            'task_id' => $payload['task'] ?? ($sourceComment?->task_id),
            'source_comment_id' => $payload['sourceComment'] ?? null,
            'created_by_id' => $request->user()->getKey(),
            'title' => $payload['title'],
            'description' => $payload['description'],
            'status' => $request->user()->role === 'client' ? 'open' : ($payload['status'] ?? 'open'),
            'priority' => $payload['priority'] ?? 'medium',
            'type' => $payload['type'] ?? 'change_request',
            'attachments' => array_values($payload['attachments'] ?? []),
        ]);
        $requestItem->load(['project', 'task', 'sourceComment.author', 'createdBy']);

        WorkspaceActions::log(
            $request->user()->getKey(),
            'request.created',
            "{$request->user()->name} created a client request",
            'request',
            $requestItem->getKey(),
            $project->id,
            $requestItem->task_id
        );

        $requestRecipients = WorkspaceActions::collaboratorIds($project)
            ->reject(fn ($id) => (string) $id === (string) $request->user()->getKey())
            ->all();

        WorkspaceActions::notify(
            $requestRecipients,
            'New request submitted',
            "{$requestItem->title} was submitted in {$project->name}.",
            'request',
            $requestItem->getKey(),
            $project->id,
            [
                'actorName' => $request->user()->name,
                'projectName' => $project->name,
                'requestTitle' => $requestItem->title,
                'priority' => str($requestItem->priority)->replace('_', ' ')->title()->toString(),
                'status' => str($requestItem->status)->replace('_', ' ')->title()->toString(),
            ],
            false,
            'requests',
            (int) $request->user()->getKey(),
        );

        return response()->json([
            'request' => WorkspacePresenter::request($requestItem),
        ], 201);
    }

    public function update(Request $request, WorkspaceRequest $workspaceRequest): JsonResponse
    {
        $existing = WorkspaceRequest::query()->findOrFail($workspaceRequest->getKey());
        WorkspaceAccess::projectOrFail($request->user(), $existing->project_id);
        $payload = $this->validatePayload($request, true);
        $targetProjectId = array_key_exists('project', $payload) ? $payload['project'] : $existing->project_id;

        if (array_key_exists('project', $payload)) {
            WorkspaceAccess::projectOrFail($request->user(), $payload['project']);
        }

        if (! empty($payload['task'])) {
            $task = WorkspaceAccess::taskOrFail($request->user(), $payload['task']);
            WorkspaceAccess::ensureTaskMatchesProject($task, $targetProjectId);
        }

        if (! empty($payload['sourceComment'])) {
            $sourceComment = Comment::query()->findOrFail($payload['sourceComment']);
            if ((string) $sourceComment->project_id !== (string) $targetProjectId) {
                throw ValidationException::withMessages([
                    'sourceComment' => 'Source message must belong to the selected project.',
                ]);
            }
        }

        $existing->update([
            ...(array_key_exists('project', $payload) ? ['project_id' => $payload['project']] : []),
            ...(array_key_exists('task', $payload) ? ['task_id' => $payload['task'] ?: null] : []),
            ...(array_key_exists('sourceComment', $payload) ? ['source_comment_id' => $payload['sourceComment'] ?: null] : []),
            ...(array_key_exists('title', $payload) ? ['title' => $payload['title']] : []),
            ...(array_key_exists('description', $payload) ? ['description' => $payload['description']] : []),
            ...(array_key_exists('status', $payload) ? ['status' => $payload['status']] : []),
            ...(array_key_exists('priority', $payload) ? ['priority' => $payload['priority']] : []),
            ...(array_key_exists('type', $payload) ? ['type' => $payload['type']] : []),
            ...(array_key_exists('attachments', $payload) ? ['attachments' => array_values($payload['attachments'] ?? [])] : []),
        ]);
        $existing->load(['project', 'task', 'sourceComment.author', 'createdBy']);

        WorkspaceActions::log(
            $request->user()->getKey(),
            'request.updated',
            "{$request->user()->name} updated a client request",
            'request',
            $existing->getKey(),
            $existing->project_id,
            $existing->task_id
        );

        $requestRecipients = WorkspaceActions::collaboratorIds($existing->project)
            ->merge([$existing->created_by_id])
            ->reject(fn ($id) => (string) $id === (string) $request->user()->getKey())
            ->unique()
            ->values()
            ->all();

        WorkspaceActions::notify(
            $requestRecipients,
            'Request updated',
            "{$existing->title} changed status to {$existing->status}.",
            'request',
            $existing->getKey(),
            $existing->project_id,
            [
                'actorName' => $request->user()->name,
                'projectName' => $existing->project?->name ?? 'Project workspace',
                'requestTitle' => $existing->title,
                'priority' => str($existing->priority)->replace('_', ' ')->title()->toString(),
                'status' => str($existing->status)->replace('_', ' ')->title()->toString(),
            ],
            false,
            'requests',
            (int) $request->user()->getKey(),
        );

        return response()->json([
            'request' => WorkspacePresenter::request($existing),
        ]);
    }

    public function destroy(Request $request, WorkspaceRequest $workspaceRequest): JsonResponse
    {
        $existing = WorkspaceRequest::query()->findOrFail($workspaceRequest->getKey());
        WorkspaceAccess::projectOrFail($request->user(), $existing->project_id);
        $existing->load('project');

        $projectId = $existing->project_id;
        $taskId = $existing->task_id;
        $requestId = $existing->id;
        $title = $existing->title;
        $projectName = $existing->project?->name ?? 'Project workspace';
        $recipients = WorkspaceActions::collaboratorIds($existing->project)
            ->merge([$existing->created_by_id])
            ->reject(fn ($id) => (string) $id === (string) $request->user()->getKey())
            ->unique()
            ->values()
            ->all();
        $existing->delete();

        WorkspaceActions::log(
            $request->user()->getKey(),
            'request.deleted',
            "{$request->user()->name} deleted a client request",
            'request',
            $requestId,
            $projectId,
            $taskId
        );
        WorkspaceActions::notify(
            $recipients,
            'Request removed',
            "{$title} was removed from {$projectName}.",
            'request',
            $requestId,
            $projectId,
            [
                'actorName' => $request->user()->name,
                'projectName' => $projectName,
                'requestTitle' => $title,
            ],
            false,
            'requests',
            (int) $request->user()->getKey(),
        );

        return response()->json([], 204);
    }

    private function validatePayload(Request $request, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'project' => [$required, 'string'],
            'task' => ['sometimes', 'nullable', 'string'],
            'sourceComment' => ['sometimes', 'nullable', 'string'],
            'title' => [$required, 'string', 'min:2', 'max:140'],
            'description' => [$required, 'string', 'min:2', 'max:5000'],
            'status' => ['sometimes', Rule::in(['open', 'planned', 'in_progress', 'completed'])],
            'priority' => ['sometimes', Rule::in(['low', 'medium', 'high', 'urgent'])],
            'type' => ['sometimes', 'nullable', 'string', 'max:40'],
            'attachments' => ['sometimes', 'array', 'max:10'],
            'attachments.*.name' => ['required_with:attachments', 'string', 'min:1', 'max:180'],
            'attachments.*.url' => ['required_with:attachments', 'string'],
            'attachments.*.size' => ['required_with:attachments', 'integer', 'min:1', 'max:15728640'],
            'attachments.*.mimeType' => ['required_with:attachments', 'string', 'min:3', 'max:120'],
            'attachments.*.uploadedBy' => ['required_with:attachments', 'string'],
            'attachments.*.uploadedAt' => ['sometimes', 'string'],
        ]);
    }
}
