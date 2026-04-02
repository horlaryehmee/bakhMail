<?php

namespace App\Support;

use App\Mail\WorkspaceMessageMail;
use App\Models\BrandingSetting;
use App\Models\Invite;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Throwable;

class WorkspaceMailer
{
    public function currentMailConfiguration(): array
    {
        return [
            'mailer' => (string) config('mail.default', 'log'),
            'scheme' => (string) config('mail.mailers.smtp.scheme', ''),
            'host' => (string) config('mail.mailers.smtp.host', ''),
            'port' => (string) config('mail.mailers.smtp.port', ''),
            'username' => (string) config('mail.mailers.smtp.username', ''),
            'fromAddress' => (string) config('mail.from.address', ''),
            'fromName' => (string) config('mail.from.name', ''),
        ];
    }

    public function sendInvite(Invite $invite, ?User $invitedBy = null): void
    {
        $branding = $this->branding();
        $inviteUrl = rtrim($branding['appUrl'], '/') . '/?invite=' . $invite->token;
        $roleLabel = Str::of($invite->role)->replace('_', ' ')->title()->toString();

        $this->sendToAddress(
            $invite->email,
            [
                'subject' => "{$branding['brandName']} invite for {$roleLabel} access",
                'eyebrow' => 'Secure invite',
                'headline' => 'Create your workspace account',
                'intro' => $invitedBy
                    ? "{$invitedBy->name} invited you to join {$branding['brandName']} as {$roleLabel}."
                    : "You were invited to join {$branding['brandName']} as {$roleLabel}.",
                'body' => 'Use the secure invite button below to create your account and access the workspace.',
                'actionLabel' => 'Accept invite',
                'actionUrl' => $inviteUrl,
                'details' => [
                    ['label' => 'Invite email', 'value' => $invite->email],
                    ['label' => 'Role', 'value' => $roleLabel],
                    ['label' => 'Expires', 'value' => optional($invite->expires_at)->format('M j, Y g:i A') ?: 'Soon'],
                ],
                'footer' => 'If you were not expecting this invite, you can safely ignore this email.',
            ]
        );
    }

    public function sendPasswordResetLink(User $user, string $token): void
    {
        $branding = $this->branding();
        $resetUrl = rtrim($branding['appUrl'], '/') . '/?reset=' . urlencode($token) . '&email=' . urlencode($user->email);
        $expiryMinutes = (int) config('auth.passwords.users.expire', 60);

        $this->sendToAddress(
            $user->email,
            [
                'subject' => "Reset your {$branding['brandName']} password",
                'eyebrow' => 'Account recovery',
                'headline' => 'Reset your workspace password',
                'intro' => 'We received a request to reset the password for your workspace account.',
                'body' => 'Use the secure button below to choose a new password. If you did not request this, you can ignore the email and your current password will keep working.',
                'actionLabel' => 'Reset password',
                'actionUrl' => $resetUrl,
                'details' => [
                    ['label' => 'Account', 'value' => $user->email],
                    ['label' => 'Link expires', 'value' => "{$expiryMinutes} minutes"],
                ],
                'footer' => 'For security, this link can only be used once and older sign-ins will be cleared after a successful reset.',
                'recipientName' => $user->name,
            ]
        );
    }

    public function sendPasswordResetConfirmation(User $user): void
    {
        $branding = $this->branding();

        $this->sendToAddress(
            $user->email,
            [
                'subject' => "{$branding['brandName']} password updated",
                'eyebrow' => 'Security update',
                'headline' => 'Your password was changed',
                'intro' => 'The password for your workspace account was reset successfully.',
                'body' => 'If this was you, no further action is needed. If you did not make this change, contact your workspace administrator immediately.',
                'actionLabel' => 'Open workspace',
                'actionUrl' => $branding['appUrl'],
                'details' => [
                    ['label' => 'Account', 'value' => $user->email],
                    ['label' => 'Changed at', 'value' => now()->format('M j, Y g:i A')],
                ],
                'footer' => 'As a security precaution, older sign-ins were invalidated when the password changed.',
                'recipientName' => $user->name,
            ]
        );
    }

    public function sendTestMessage(string $email): void
    {
        $branding = $this->branding();

        Mail::to($email)->send(new WorkspaceMessageMail(
            branding: $branding,
            messageData: [
                'subject' => "{$branding['brandName']} email test",
                'eyebrow' => 'Email test',
                'headline' => 'SMTP delivery is connected',
                'intro' => 'This is a live test from your workspace email configuration.',
                'body' => 'If you received this message, branded emails from invites, comments, requests, task updates, and activity notifications can be delivered from this server.',
                'actionLabel' => 'Open workspace',
                'actionUrl' => $branding['appUrl'],
                'details' => [
                    ['label' => 'Mailer', 'value' => (string) config('mail.default', 'log')],
                    ['label' => 'Host', 'value' => (string) config('mail.mailers.smtp.host', 'not configured')],
                    ['label' => 'Sent at', 'value' => now()->format('M j, Y g:i A')],
                ],
                'footer' => 'You can ignore this message after confirming delivery.',
            ],
        ));
    }

    public function sendNotificationByIds(array|Collection $recipientIds, string $preferenceKey, array $payload, ?int $excludeUserId = null): void
    {
        $ids = collect($recipientIds)
            ->filter()
            ->when($excludeUserId, fn (Collection $collection) => $collection->reject(fn ($id) => (string) $id === (string) $excludeUserId))
            ->unique()
            ->values();

        if ($ids->isEmpty()) {
            return;
        }

        $recipients = User::query()
            ->whereIn('id', $ids)
            ->where('is_active', true)
            ->get()
            ->filter(fn (User $user) => filled($user->email) && $user->wantsEmailFor($preferenceKey));

        if ($recipients->isEmpty()) {
            return;
        }

        $message = $this->messageForNotification($preferenceKey, $payload);

        foreach ($recipients as $recipient) {
            $personalized = $message;
            $personalized['recipientName'] = $recipient->name;

            $this->sendToAddress($recipient->email, $personalized);
        }
    }

    public function sendDeadlineDigests(?Carbon $reference = null): int
    {
        $now = ($reference ?? now())->copy();
        $windowEnd = $now->copy()->addDays(3)->endOfDay();

        $tasks = Task::query()
            ->with(['project', 'assignee', 'reporter'])
            ->where('status', '!=', 'completed')
            ->whereBetween('due_date', [$now->copy()->startOfDay(), $windowEnd])
            ->orderBy('due_date')
            ->get();

        $projects = Project::query()
            ->with(['createdBy', 'teamMembers', 'clients'])
            ->whereIn('status', ['not_started', 'in_progress'])
            ->whereBetween('deadline', [$now->copy()->startOfDay(), $windowEnd])
            ->orderBy('deadline')
            ->get();

        $sent = 0;

        User::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get()
            ->each(function (User $user) use (&$sent, $projects, $tasks, $windowEnd): void {
                if (! filled($user->email) || ! $user->wantsEmailFor('deadlines')) {
                    return;
                }

                $projectIds = WorkspaceAccess::projectIdsFor($user);

                $taskHighlights = $tasks
                    ->whereIn('project_id', $projectIds)
                    ->map(function (Task $task): array {
                        return [
                            'title' => $task->title,
                            'text' => collect([
                                $task->project?->name ? "Project: {$task->project->name}" : null,
                                $task->due_date ? 'Due ' . $task->due_date->format('M j, Y') : null,
                                $task->priority ? Str::of($task->priority)->replace('_', ' ')->title()->toString() . ' priority' : null,
                            ])->filter()->implode(' | '),
                        ];
                    });

                $projectHighlights = $projects
                    ->whereIn('id', $projectIds)
                    ->map(function (Project $project): array {
                        return [
                            'title' => $project->name,
                            'text' => collect([
                                $project->deadline ? 'Deadline ' . $project->deadline->format('M j, Y') : null,
                                $project->status ? Str::of($project->status)->replace('_', ' ')->title()->toString() : null,
                            ])->filter()->implode(' | '),
                        ];
                    });

                $highlights = $taskHighlights->concat($projectHighlights)->take(8)->values()->all();

                if ($highlights === []) {
                    return;
                }

                $branding = $this->branding();

                $this->sendToAddress($user->email, [
                    'subject' => "Upcoming deadlines in {$branding['brandName']}",
                    'eyebrow' => 'Deadlines',
                    'headline' => 'You have work coming due soon',
                    'intro' => 'These tasks and project deadlines are approaching in the next three days.',
                    'body' => "Review them now so nothing slips before {$windowEnd->format('M j, Y')}.",
                    'highlights' => $highlights,
                    'actionLabel' => 'Open workspace',
                    'actionUrl' => $branding['appUrl'],
                    'footer' => 'You can change email notification preferences from your account settings inside the workspace.',
                    'recipientName' => $user->name,
                ]);

                $sent++;
            });

        return $sent;
    }

    private function messageForNotification(string $preferenceKey, array $payload): array
    {
        $branding = $this->branding();
        $metadata = $payload['metadata'] ?? [];
        $entityLabel = $this->entityLabel((string) ($payload['entityType'] ?? $preferenceKey));

        return [
            'subject' => (string) ($payload['title'] ?? "{$branding['brandName']} update"),
            'eyebrow' => match ($preferenceKey) {
                'comments' => 'Comments',
                'requests' => 'Requests',
                'deadlines' => 'Deadlines',
                default => 'Activity',
            },
            'headline' => (string) ($payload['title'] ?? "{$entityLabel} update"),
            'intro' => (string) ($payload['message'] ?? ''),
            'body' => (string) ($metadata['body'] ?? ''),
            'details' => $this->detailsFromMetadata($metadata),
            'actionLabel' => (string) ($metadata['actionLabel'] ?? 'Open workspace'),
            'actionUrl' => (string) ($metadata['actionUrl'] ?? $branding['appUrl']),
            'footer' => 'This email was sent by the workspace because this notification type is enabled on your account.',
        ];
    }

    private function detailsFromMetadata(array $metadata): array
    {
        $map = [
            'actorName' => 'From',
            'projectName' => 'Project',
            'taskTitle' => 'Task',
            'requestTitle' => 'Request',
            'status' => 'Status',
            'priority' => 'Priority',
            'dueDate' => 'Due date',
            'deadline' => 'Deadline',
            'role' => 'Role',
        ];

        return collect($map)
            ->map(function (string $label, string $key) use ($metadata): ?array {
                $value = $metadata[$key] ?? null;

                if (blank($value)) {
                    return null;
                }

                return ['label' => $label, 'value' => (string) $value];
            })
            ->filter()
            ->values()
            ->all();
    }

    private function branding(): array
    {
        $branding = BrandingSetting::query()->where('key', 'branding')->first();
        $appUrl = rtrim((string) config('app.url'), '/') ?: 'http://localhost';
        $brandingPayload = WorkspacePresenter::branding($branding);
        $logoUrl = (string) ($brandingPayload['logoUrl'] ?? '');
        $logoVersion = (string) ($brandingPayload['logoVersion'] ?? '');

        if ($logoUrl !== '' && ! Str::startsWith($logoUrl, ['http://', 'https://', 'data:'])) {
            $logoUrl = $appUrl . '/' . ltrim($logoUrl, '/');
        }

        if ($logoUrl !== '' && $logoVersion !== '') {
            $logoUrl .= (str_contains($logoUrl, '?') ? '&' : '?') . 'v=' . rawurlencode($logoVersion);
        }

        return [
            'brandName' => (string) ($brandingPayload['brandName'] ?? config('app.name', 'TaskManager')),
            'logoUrl' => $logoUrl,
            'logoVersion' => $logoVersion,
            'appUrl' => $appUrl,
        ];
    }

    private function sendToAddress(string $email, array $message): void
    {
        try {
            Mail::to($email)->send(new WorkspaceMessageMail(
                branding: $this->branding(),
                messageData: $message,
            ));
        } catch (Throwable $exception) {
            Log::warning('Workspace email delivery failed.', [
                'email' => $email,
                'subject' => $message['subject'] ?? null,
                'error' => $exception->getMessage(),
            ]);
        }
    }

    private function entityLabel(string $entityType): string
    {
        return Str::of($entityType)->replace(['_', '.'], ' ')->title()->toString();
    }
}
