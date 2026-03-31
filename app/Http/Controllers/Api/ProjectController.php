<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Models\User;
use App\Support\WorkspaceAccess;
use App\Support\WorkspaceActions;
use App\Support\WorkspacePresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ProjectController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $projects = WorkspaceAccess::applyProjectScope(
            Project::query()->with(['createdBy', 'teamMembers', 'clients']),
            $user
        )
            ->when($request->filled('search'), function ($query) use ($request): void {
                $search = trim((string) $request->query('search'));
                $query->where(function ($builder) use ($search): void {
                    $builder->where('name', 'like', "%{$search}%")
                        ->orWhere('summary', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%");
                });
            })
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')->toString()))
            ->when($request->filled('priority'), fn ($query) => $query->where('priority', $request->string('priority')->toString()))
            ->orderBy('deadline')
            ->latest('created_at')
            ->get();

        $projects->loadCount([
            'tasks',
            'tasks as completed_tasks_count' => fn ($query) => $query->where('status', 'completed'),
        ]);

        return response()->json([
            'projects' => $projects->map(fn (Project $project) => WorkspacePresenter::project(
                $project,
                $project->tasks_count,
                $project->completed_tasks_count
            ))->all(),
        ]);
    }

    public function show(Request $request, Project $project): JsonResponse
    {
        $project = WorkspaceAccess::projectOrFail($request->user(), $project->getKey());
        $project->loadCount([
            'tasks',
            'tasks as completed_tasks_count' => fn ($query) => $query->where('status', 'completed'),
        ]);

        return response()->json([
            'project' => WorkspacePresenter::project($project, $project->tasks_count, $project->completed_tasks_count),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $payload = $this->validatePayload($request);
        $this->ensureUsersExist($payload['teamMembers'] ?? [], 'Internal team');
        $this->ensureUsersExist($payload['clients'] ?? [], 'Client accounts');

        $project = Project::query()->create([
            'name' => $payload['name'],
            'summary' => $payload['summary'] ?? '',
            'description' => $payload['description'] ?? '',
            'status' => $payload['status'] ?? 'not_started',
            'priority' => $payload['priority'] ?? 'medium',
            'type' => $payload['type'] ?? 'Website',
            'tags' => array_values($payload['tags'] ?? []),
            'start_date' => $payload['startDate'] ?? null,
            'deadline' => $payload['deadline'] ?? null,
            'preview_type' => $payload['previewType'] ?? 'website',
            'preview_url' => $payload['previewUrl'] ?? '',
            'preview_image_url' => $payload['previewImageUrl'] ?? '',
            'preview_video_url' => $payload['previewVideoUrl'] ?? '',
            'attachments' => array_values($payload['attachments'] ?? []),
            'created_by_id' => $request->user()->getKey(),
        ]);
        $project->teamMembers()->sync($payload['teamMembers'] ?? []);
        $project->clients()->sync($payload['clients'] ?? []);
        $project->load(['createdBy', 'teamMembers', 'clients']);

        $recipients = WorkspaceActions::collaboratorIds($project)
            ->reject(fn ($id) => (string) $id === (string) $request->user()->getKey())
            ->all();

        WorkspaceActions::notify(
            $recipients,
            'You were added to a project',
            "You were added to {$project->name}.",
            'project',
            $project->getKey(),
            $project->getKey(),
            [
                'actorName' => $request->user()->name,
                'projectName' => $project->name,
                'deadline' => optional($project->deadline)?->format('M j, Y'),
            ],
            false,
            'activity',
            (int) $request->user()->getKey(),
        );

        WorkspaceActions::log(
            $request->user()->getKey(),
            'project.created',
            "{$request->user()->name} created project {$project->name}",
            'project',
            $project->getKey(),
            $project->getKey()
        );

        return response()->json([
            'project' => WorkspacePresenter::project($project, 0, 0),
        ], 201);
    }

    public function update(Request $request, Project $project): JsonResponse
    {
        $project = WorkspaceAccess::projectOrFail($request->user(), $project->getKey());
        $previousDeadline = $project->deadline?->copy();
        $payload = $this->validatePayload($request, true);
        $this->ensureUsersExist($payload['teamMembers'] ?? [], 'Internal team');
        $this->ensureUsersExist($payload['clients'] ?? [], 'Client accounts');

        $project->update([
            ...(array_key_exists('name', $payload) ? ['name' => $payload['name']] : []),
            ...(array_key_exists('summary', $payload) ? ['summary' => $payload['summary'] ?? ''] : []),
            ...(array_key_exists('description', $payload) ? ['description' => $payload['description'] ?? ''] : []),
            ...(array_key_exists('status', $payload) ? ['status' => $payload['status']] : []),
            ...(array_key_exists('priority', $payload) ? ['priority' => $payload['priority']] : []),
            ...(array_key_exists('type', $payload) ? ['type' => $payload['type'] ?? 'Website'] : []),
            ...(array_key_exists('tags', $payload) ? ['tags' => array_values($payload['tags'] ?? [])] : []),
            ...(array_key_exists('startDate', $payload) ? ['start_date' => $payload['startDate'] ?: null] : []),
            ...(array_key_exists('deadline', $payload) ? ['deadline' => $payload['deadline'] ?: null] : []),
            ...(array_key_exists('previewType', $payload) ? ['preview_type' => $payload['previewType'] ?? 'website'] : []),
            ...(array_key_exists('previewUrl', $payload) ? ['preview_url' => $payload['previewUrl'] ?? ''] : []),
            ...(array_key_exists('previewImageUrl', $payload) ? ['preview_image_url' => $payload['previewImageUrl'] ?? ''] : []),
            ...(array_key_exists('previewVideoUrl', $payload) ? ['preview_video_url' => $payload['previewVideoUrl'] ?? ''] : []),
            ...(array_key_exists('attachments', $payload) ? ['attachments' => array_values($payload['attachments'] ?? [])] : []),
        ]);

        if (array_key_exists('teamMembers', $payload)) {
            $project->teamMembers()->sync($payload['teamMembers'] ?? []);
        }

        if (array_key_exists('clients', $payload)) {
            $project->clients()->sync($payload['clients'] ?? []);
        }

        $project->load(['createdBy', 'teamMembers', 'clients']);
        $project->loadCount([
            'tasks',
            'tasks as completed_tasks_count' => fn ($query) => $query->where('status', 'completed'),
        ]);

        WorkspaceActions::log(
            $request->user()->getKey(),
            'project.updated',
            "{$request->user()->name} updated project {$project->name}",
            'project',
            $project->getKey(),
            $project->getKey()
        );

        $activityRecipients = WorkspaceActions::collaboratorIds($project)
            ->reject(fn ($id) => (string) $id === (string) $request->user()->getKey())
            ->all();

        WorkspaceActions::notify(
            $activityRecipients,
            'Project updated',
            "{$request->user()->name} updated {$project->name}.",
            'project',
            $project->getKey(),
            $project->getKey(),
            [
                'actorName' => $request->user()->name,
                'projectName' => $project->name,
                'status' => str($project->status)->replace('_', ' ')->title()->toString(),
                'priority' => str($project->priority)->replace('_', ' ')->title()->toString(),
                'deadline' => optional($project->deadline)?->format('M j, Y'),
            ],
            false,
            'activity',
            (int) $request->user()->getKey(),
        );

        if ((string) optional($previousDeadline)?->toDateString() !== (string) optional($project->deadline)?->toDateString() && $project->deadline) {
            WorkspaceActions::notify(
                $activityRecipients,
                'Project deadline changed',
                "{$project->name} now has a deadline of {$project->deadline->format('M j, Y')}.",
                'project',
                $project->getKey(),
                $project->getKey(),
                [
                    'actorName' => $request->user()->name,
                    'projectName' => $project->name,
                    'deadline' => $project->deadline->format('M j, Y'),
                ],
                false,
                'deadlines',
                (int) $request->user()->getKey(),
            );
        }

        return response()->json([
            'project' => WorkspacePresenter::project($project, $project->tasks_count, $project->completed_tasks_count),
        ]);
    }

    public function destroy(Request $request, Project $project): JsonResponse
    {
        $project = WorkspaceAccess::projectOrFail($request->user(), $project->getKey());
        $projectId = $project->getKey();
        $name = $project->name;
        $recipients = WorkspaceActions::collaboratorIds($project)
            ->reject(fn ($id) => (string) $id === (string) $request->user()->getKey())
            ->all();

        $project->delete();
        WorkspaceActions::log($request->user()->getKey(), 'project.deleted', "{$request->user()->name} deleted project {$name}", 'project', $projectId);
        WorkspaceActions::notify(
            $recipients,
            'Project removed',
            "{$name} was removed from the workspace.",
            'project',
            $projectId,
            null,
            [
                'actorName' => $request->user()->name,
                'projectName' => $name,
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
            'name' => [$required, 'string', 'min:2', 'max:120'],
            'summary' => ['sometimes', 'nullable', 'string', 'max:240'],
            'description' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'status' => ['sometimes', Rule::in(['not_started', 'in_progress', 'completed'])],
            'priority' => ['sometimes', Rule::in(['low', 'medium', 'high', 'urgent'])],
            'type' => ['sometimes', 'nullable', 'string', 'max:80'],
            'tags' => ['sometimes', 'array', 'max:20'],
            'tags.*' => ['string', 'max:40'],
            'startDate' => ['sometimes', 'nullable', 'date'],
            'deadline' => ['sometimes', 'nullable', 'date'],
            'previewType' => ['sometimes', Rule::in(['none', 'website', 'image', 'video'])],
            'previewUrl' => ['sometimes', 'nullable', 'string', 'max:2048'],
            'previewImageUrl' => ['sometimes', 'nullable', 'string', 'max:2048'],
            'previewVideoUrl' => ['sometimes', 'nullable', 'string', 'max:2048'],
            'teamMembers' => ['sometimes', 'array', 'max:30'],
            'teamMembers.*' => ['string'],
            'clients' => ['sometimes', 'array', 'max:30'],
            'clients.*' => ['string'],
            'attachments' => ['sometimes', 'array', 'max:10'],
            'attachments.*.name' => ['required_with:attachments', 'string', 'min:1', 'max:180'],
            'attachments.*.url' => ['required_with:attachments', 'string'],
            'attachments.*.size' => ['required_with:attachments', 'integer', 'min:1', 'max:15728640'],
            'attachments.*.mimeType' => ['required_with:attachments', 'string', 'min:3', 'max:120'],
            'attachments.*.uploadedBy' => ['required_with:attachments', 'string'],
            'attachments.*.uploadedAt' => ['sometimes', 'string'],
        ]);
    }

    private function ensureUsersExist(array $ids, string $label): void
    {
        $uniqueIds = array_values(array_unique(array_filter($ids)));

        if ($uniqueIds === []) {
            return;
        }

        if (User::query()->whereIn('id', $uniqueIds)->count() !== count($uniqueIds)) {
            throw ValidationException::withMessages([
                'users' => "{$label} contains one or more invalid users.",
            ]);
        }
    }
}
