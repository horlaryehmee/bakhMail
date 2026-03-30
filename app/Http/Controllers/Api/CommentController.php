<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Comment;
use App\Support\WorkspaceAccess;
use App\Support\WorkspaceActions;
use App\Support\WorkspacePresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class CommentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $comments = Comment::query()
            ->with(['author', 'mentions', 'replyTo.author'])
            ->whereIn('project_id', WorkspaceAccess::projectIdsFor($request->user()))
            ->when($request->filled('projectId'), fn ($query) => $query->where('project_id', $request->query('projectId')))
            ->when($request->filled('taskId'), fn ($query) => $query->where('task_id', $request->query('taskId')))
            ->latest()
            ->get();

        return response()->json([
            'comments' => $comments->map(fn (Comment $comment) => WorkspacePresenter::comment($comment))->all(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'project' => ['required', 'string'],
            'task' => ['sometimes', 'nullable', 'string'],
            'replyTo' => ['sometimes', 'nullable', 'string'],
            'content' => ['nullable', 'string', 'max:5000'],
            'mentions' => ['sometimes', 'array', 'max:20'],
            'mentions.*' => ['string'],
            'attachments' => ['sometimes', 'array', 'max:10'],
            'attachments.*.name' => ['required_with:attachments', 'string', 'min:1', 'max:180'],
            'attachments.*.url' => ['required_with:attachments', 'string'],
            'attachments.*.size' => ['required_with:attachments', 'integer', 'min:1', 'max:15728640'],
            'attachments.*.mimeType' => ['required_with:attachments', 'string', 'min:3', 'max:120'],
            'attachments.*.uploadedBy' => ['required_with:attachments', 'string'],
            'attachments.*.uploadedAt' => ['sometimes', 'string'],
        ]);

        if (blank($payload['content'] ?? '') && empty($payload['attachments'] ?? [])) {
            throw ValidationException::withMessages([
                'content' => 'Add a message or attachment before sending.',
            ]);
        }

        $project = WorkspaceAccess::projectOrFail($request->user(), $payload['project']);
        $task = ! empty($payload['task']) ? WorkspaceAccess::taskOrFail($request->user(), $payload['task']) : null;

        if ($task) {
            WorkspaceAccess::ensureTaskMatchesProject($task, $project->id);
        }

        $replyTo = ! empty($payload['replyTo'])
            ? Comment::query()->with('author')->findOrFail($payload['replyTo'])
            : null;

        if ($replyTo && (string) $replyTo->project_id !== (string) $project->id) {
            throw ValidationException::withMessages([
                'replyTo' => 'Replies must stay inside the same project.',
            ]);
        }

        $allowedMentionIds = WorkspaceActions::collaboratorIds($project)->map(fn ($id) => (string) $id)->all();
        foreach ($payload['mentions'] ?? [] as $mentionId) {
            if (! in_array((string) $mentionId, $allowedMentionIds, true)) {
                throw ValidationException::withMessages([
                    'mentions' => 'Mentions must belong to the selected project.',
                ]);
            }
        }

        $comment = Comment::query()->create([
            'project_id' => $project->id,
            'task_id' => $payload['task'] ?? ($replyTo?->task_id),
            'reply_to_id' => $payload['replyTo'] ?? null,
            'author_id' => $request->user()->getKey(),
            'content' => $payload['content'] ?? '',
            'attachments' => array_values($payload['attachments'] ?? []),
        ]);
        $comment->mentions()->sync(array_values(array_unique($payload['mentions'] ?? [])));
        $comment->load(['author', 'mentions', 'replyTo.author']);

        WorkspaceActions::log(
            $request->user()->getKey(),
            'comment.created',
            "{$request->user()->name} commented on a project",
            'comment',
            $comment->getKey(),
            $project->id,
            $comment->task_id
        );

        $replyRecipient = $replyTo && (string) $replyTo->author_id !== (string) $request->user()->getKey()
            ? [$replyTo->author_id]
            : [];

        WorkspaceActions::notify(
            array_values(array_unique([
                ...($payload['mentions'] ?? []),
                ...$replyRecipient,
            ])),
            'New chat message',
            "{$request->user()->name} sent a message in the project chat.",
            'comment',
            $comment->getKey(),
            $project->id,
            ['projectId' => $project->id]
        );

        return response()->json([
            'comment' => WorkspacePresenter::comment($comment),
        ], 201);
    }

    public function destroy(Request $request, Comment $comment): JsonResponse
    {
        $existing = Comment::query()->findOrFail($comment->getKey());
        WorkspaceAccess::projectOrFail($request->user(), $existing->project_id);

        Comment::query()->where('reply_to_id', $existing->getKey())->update(['reply_to_id' => null]);
        $existing->mentions()->detach();

        $projectId = $existing->project_id;
        $taskId = $existing->task_id;
        $commentId = $existing->id;
        $existing->delete();

        WorkspaceActions::log(
            $request->user()->getKey(),
            'comment.deleted',
            "{$request->user()->name} deleted a chat message",
            'comment',
            $commentId,
            $projectId,
            $taskId
        );

        return response()->json([], 204);
    }
}
