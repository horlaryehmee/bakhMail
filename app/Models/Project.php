<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Project extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'summary',
        'description',
        'status',
        'priority',
        'type',
        'tags',
        'start_date',
        'deadline',
        'progress',
        'preview_type',
        'preview_url',
        'preview_image_url',
        'preview_video_url',
        'attachments',
        'created_by_id',
        'demo_data',
    ];

    protected function casts(): array
    {
        return [
            'tags' => 'array',
            'attachments' => 'array',
            'start_date' => 'datetime',
            'deadline' => 'datetime',
            'progress' => 'integer',
            'demo_data' => 'boolean',
        ];
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_id');
    }

    public function teamMembers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'project_team_members');
    }

    public function clients(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'project_clients');
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class);
    }

    public function comments(): HasMany
    {
        return $this->hasMany(Comment::class);
    }

    public function requests(): HasMany
    {
        return $this->hasMany(WorkspaceRequest::class);
    }
}
