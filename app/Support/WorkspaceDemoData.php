<?php

namespace App\Support;

use App\Models\ActivityLog;
use App\Models\Comment;
use App\Models\Invite;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use App\Models\WorkspaceNotification;
use App\Models\WorkspaceRequest;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class WorkspaceDemoData
{
    public static function status(): array
    {
        $counts = [
            'users' => User::query()->where('demo_data', true)->count(),
            'projects' => Project::query()->where('demo_data', true)->count(),
            'tasks' => Task::query()->where('demo_data', true)->count(),
            'comments' => Comment::query()->where('demo_data', true)->count(),
            'requests' => WorkspaceRequest::query()->where('demo_data', true)->count(),
            'notifications' => WorkspaceNotification::query()->where('demo_data', true)->count(),
            'activity' => ActivityLog::query()->where('demo_data', true)->count(),
            'invites' => Invite::query()->where('demo_data', true)->count(),
        ];

        return [
            'populated' => collect($counts)->sum() > 0,
            'counts' => $counts,
            'sampleAccounts' => [
                ['name' => 'Demo Admin', 'email' => 'demo.admin@bakhtech.local', 'role' => 'admin', 'password' => 'DemoAdmin123!'],
                ['name' => 'Demo Client One', 'email' => 'demo.client.one@bakhtech.local', 'role' => 'client', 'password' => 'DemoClient123!'],
                ['name' => 'Demo Client Two', 'email' => 'demo.client.two@bakhtech.local', 'role' => 'client', 'password' => 'DemoClient123!'],
            ],
        ];
    }

    public static function clear(): array
    {
        DB::transaction(function (): void {
            Invite::query()->where('demo_data', true)->delete();
            WorkspaceNotification::query()->where('demo_data', true)->delete();
            ActivityLog::query()->where('demo_data', true)->delete();
            WorkspaceRequest::query()->where('demo_data', true)->delete();
            DB::table('comment_mentions')->whereIn('comment_id', Comment::query()->where('demo_data', true)->pluck('id'))->delete();
            Comment::query()->where('demo_data', true)->delete();
            Task::query()->where('demo_data', true)->delete();
            DB::table('project_team_members')->whereIn('project_id', Project::query()->where('demo_data', true)->pluck('id'))->delete();
            DB::table('project_clients')->whereIn('project_id', Project::query()->where('demo_data', true)->pluck('id'))->delete();
            Project::query()->where('demo_data', true)->delete();
            User::query()->where('demo_data', true)->delete();
        });

        return static::status();
    }

    public static function populate(User $masterAdmin): array
    {
        static::clear();

        DB::transaction(function () use ($masterAdmin): void {
            $demoAdmin = User::query()->create([
                'name' => 'Demo Admin',
                'email' => 'demo.admin@bakhtech.local',
                'password' => Hash::make('DemoAdmin123!'),
                'role' => 'admin',
                'title' => 'Demo Admin',
                'notification_preferences' => WorkspacePresenter::defaultNotificationPreferences(),
                'is_active' => true,
                'demo_data' => true,
            ]);

            $clientOne = User::query()->create([
                'name' => 'Demo Client One',
                'email' => 'demo.client.one@bakhtech.local',
                'password' => Hash::make('DemoClient123!'),
                'role' => 'client',
                'title' => 'Client',
                'notification_preferences' => WorkspacePresenter::defaultNotificationPreferences(),
                'is_active' => true,
                'demo_data' => true,
            ]);

            $clientTwo = User::query()->create([
                'name' => 'Demo Client Two',
                'email' => 'demo.client.two@bakhtech.local',
                'password' => Hash::make('DemoClient123!'),
                'role' => 'client',
                'title' => 'Client',
                'notification_preferences' => WorkspacePresenter::defaultNotificationPreferences(),
                'is_active' => true,
                'demo_data' => true,
            ]);

            $projectOne = Project::query()->create([
                'name' => 'Demo Website Refresh',
                'summary' => 'Sample website delivery with client review and active milestones.',
                'description' => 'Demo workspace for testing previews, task movement, chat, requests, notifications, and client collaboration.',
                'status' => 'in_progress',
                'priority' => 'high',
                'type' => 'Website',
                'tags' => ['Demo', 'Website', 'Review'],
                'start_date' => now()->subDays(8),
                'deadline' => now()->addDays(9),
                'progress' => 0,
                'preview_type' => 'website',
                'preview_url' => 'https://example.com',
                'attachments' => [],
                'created_by_id' => $masterAdmin->id,
                'demo_data' => true,
            ]);
            $projectOne->teamMembers()->sync([$demoAdmin->id]);
            $projectOne->clients()->sync([$clientOne->id]);

            $projectTwo = Project::query()->create([
                'name' => 'Demo Launch Campaign',
                'summary' => 'Sample non-website project showing secondary portfolio coverage.',
                'description' => 'Secondary demo project for layout coverage and team workload.',
                'status' => 'in_progress',
                'priority' => 'medium',
                'type' => 'Marketing',
                'tags' => ['Campaign', 'Assets'],
                'start_date' => now()->subDays(4),
                'deadline' => now()->addDays(16),
                'progress' => 50,
                'preview_type' => 'image',
                'preview_image_url' => '',
                'attachments' => [],
                'created_by_id' => $masterAdmin->id,
                'demo_data' => true,
            ]);
            $projectTwo->teamMembers()->sync([$demoAdmin->id]);
            $projectTwo->clients()->sync([$clientTwo->id]);

            $taskOne = Task::query()->create([
                'project_id' => $projectOne->id,
                'title' => 'Finalize homepage hero',
                'description' => 'Polish the top section before client review.',
                'status' => 'in_progress',
                'priority' => 'high',
                'assignee_id' => $demoAdmin->id,
                'reporter_id' => $masterAdmin->id,
                'milestone' => false,
                'order' => 0,
                'tags' => ['hero', 'homepage'],
                'subtasks' => [],
                'attachments' => [],
                'due_date' => now()->addDay(),
                'demo_data' => true,
            ]);

            $taskTwo = Task::query()->create([
                'project_id' => $projectOne->id,
                'title' => 'Client approval milestone',
                'description' => 'Approval checkpoint after review.',
                'status' => 'todo',
                'priority' => 'medium',
                'assignee_id' => $demoAdmin->id,
                'reporter_id' => $masterAdmin->id,
                'milestone' => true,
                'order' => 1,
                'tags' => ['approval'],
                'subtasks' => [],
                'attachments' => [],
                'due_date' => now()->addDays(2),
                'demo_data' => true,
            ]);

            $taskThree = Task::query()->create([
                'project_id' => $projectTwo->id,
                'title' => 'Review campaign asset pack',
                'description' => 'Confirm campaign asset pack for launch.',
                'status' => 'completed',
                'priority' => 'medium',
                'assignee_id' => $demoAdmin->id,
                'reporter_id' => $masterAdmin->id,
                'milestone' => false,
                'order' => 0,
                'tags' => ['assets'],
                'subtasks' => [],
                'attachments' => [],
                'due_date' => now()->addDays(3),
                'demo_data' => true,
            ]);

            WorkspaceActions::updateProjectProgress($projectOne->id);
            WorkspaceActions::updateProjectProgress($projectTwo->id);

            $comment = Comment::query()->create([
                'project_id' => $projectOne->id,
                'task_id' => $taskOne->id,
                'author_id' => $clientOne->id,
                'content' => 'Can we tighten the hero copy before the next review?',
                'attachments' => [],
                'demo_data' => true,
            ]);
            $comment->mentions()->sync([$demoAdmin->id]);

            WorkspaceRequest::query()->create([
                'project_id' => $projectOne->id,
                'task_id' => $taskOne->id,
                'source_comment_id' => $comment->id,
                'created_by_id' => $clientOne->id,
                'title' => 'Update hero copy',
                'description' => 'Please reduce the text and sharpen the CTA on the homepage hero.',
                'status' => 'open',
                'priority' => 'medium',
                'type' => 'change_request',
                'attachments' => [],
                'demo_data' => true,
            ]);

            WorkspaceActions::notify(
                [$demoAdmin->id, $masterAdmin->id],
                'New chat message',
                'Demo Client One sent a message in the project chat.',
                'comment',
                $comment->id,
                $projectOne->id,
                ['projectId' => $projectOne->id],
                true
            );

            WorkspaceActions::log($masterAdmin->id, 'project.created', 'Demo workspace loaded.', 'project', $projectOne->id, $projectOne->id, null, [], true);

            Invite::query()->create([
                'email' => 'demo.pending.client@bakhtech.local',
                'role' => 'client',
                'token' => Str::random(48),
                'invited_by_id' => $masterAdmin->id,
                'expires_at' => now()->addWeek(),
                'demo_data' => true,
            ]);
        });

        return static::status();
    }
}
