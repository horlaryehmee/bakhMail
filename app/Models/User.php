<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'title',
        'avatar_url',
        'notification_preferences',
        'is_active',
        'api_token',
        'demo_data',
    ];

    protected $hidden = [
        'password',
        'remember_token',
        'api_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'notification_preferences' => 'array',
            'is_active' => 'boolean',
            'demo_data' => 'boolean',
        ];
    }

    public function createdProjects(): HasMany
    {
        return $this->hasMany(Project::class, 'created_by_id');
    }

    public function teamProjects(): BelongsToMany
    {
        return $this->belongsToMany(Project::class, 'project_team_members');
    }

    public function clientProjects(): BelongsToMany
    {
        return $this->belongsToMany(Project::class, 'project_clients');
    }

    public function assignedTasks(): HasMany
    {
        return $this->hasMany(Task::class, 'assignee_id');
    }

    public function reportedTasks(): HasMany
    {
        return $this->hasMany(Task::class, 'reporter_id');
    }

    public function comments(): HasMany
    {
        return $this->hasMany(Comment::class, 'author_id');
    }

    public function requests(): HasMany
    {
        return $this->hasMany(WorkspaceRequest::class, 'created_by_id');
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(WorkspaceNotification::class, 'recipient_id');
    }

    public function invitesSent(): HasMany
    {
        return $this->hasMany(Invite::class, 'invited_by_id');
    }

    public function activities(): HasMany
    {
        return $this->hasMany(ActivityLog::class, 'actor_id');
    }

    protected function notificationPreferences(): Attribute
    {
        return Attribute::make(
            get: fn ($value, array $attributes) => $attributes['notification_preferences']
                ? json_decode($attributes['notification_preferences'], true)
                : [
                    'comments' => true,
                    'requests' => true,
                    'deadlines' => true,
                    'activity' => false,
                ],
        );
    }
}
