<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Project;
use App\Models\Task;
use App\Models\WorkspaceRequest;
use App\Support\WorkspaceAccess;
use App\Support\WorkspacePresenter;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DashboardController extends Controller
{
    public function summary(Request $request)
    {
        $user = $request->user();
        $projectIds = WorkspaceAccess::projectIdsFor($user);
        $now = now();

        $projects = Project::query()
            ->whereIn('id', $projectIds)
            ->with(['createdBy', 'teamMembers', 'clients'])
            ->orderBy('deadline')
            ->get();

        $tasks = Task::query()
            ->whereIn('project_id', $projectIds)
            ->with(['project', 'assignee', 'reporter'])
            ->orderBy('due_date')
            ->get();

        $requests = WorkspaceRequest::query()
            ->whereIn('project_id', $projectIds)
            ->get();

        $activities = ActivityLog::query()
            ->whereIn('project_id', $projectIds)
            ->with('actor')
            ->latest()
            ->take(15)
            ->get();

        return response()->json(WorkspacePresenter::summary([
            'totalProjects' => $projects->count(),
            'activeProjects' => $projects->where('status', 'in_progress')->count(),
            'completedProjects' => $projects->where('status', 'completed')->count(),
            'totalTasks' => $tasks->count(),
            'completedTasks' => $tasks->where('status', 'completed')->count(),
            'overdueTasks' => $tasks->filter(fn (Task $task) => $task->due_date && $task->due_date->isPast() && $task->status !== 'completed')->count(),
            'openRequests' => $requests->where('status', '!=', 'completed')->count(),
        ], $projects, $tasks, $requests, $activities));
    }

    public function exportProjectsCsv(Request $request): StreamedResponse
    {
        $projectIds = WorkspaceAccess::projectIdsFor($request->user());
        $projects = Project::query()
            ->whereIn('id', $projectIds)
            ->latest()
            ->get();

        $callback = function () use ($projects): void {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Name', 'Status', 'Priority', 'Deadline', 'Progress', 'Type']);
            foreach ($projects as $project) {
                fputcsv($handle, [
                    $project->name,
                    $project->status,
                    $project->priority,
                    optional($project->deadline)?->toIso8601String() ?? '',
                    $project->progress,
                    $project->type,
                ]);
            }
            fclose($handle);
        };

        return response()->streamDownload($callback, 'projects.csv', ['Content-Type' => 'text/csv']);
    }
}
