<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Task extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_id',
        'title',
        'description',
        'status',
        'priority',
        'assignee_id',
        'reporter_id',
        'start_date',
        'due_date',
        'milestone',
        'order',
        'tags',
        'subtasks',
        'attachments',
        'demo_data',
    ];

    protected function casts(): array
    {
        return [
            'milestone' => 'boolean',
            'order' => 'integer',
            'tags' => 'array',
            'subtasks' => 'array',
            'attachments' => 'array',
            'start_date' => 'datetime',
            'due_date' => 'datetime',
            'demo_data' => 'boolean',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assignee_id');
    }

    public function reporter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reporter_id');
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
