<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkspaceRequest extends Model
{
    use HasFactory;

    protected $table = 'requests';

    protected $fillable = [
        'project_id',
        'task_id',
        'source_comment_id',
        'created_by_id',
        'title',
        'description',
        'status',
        'priority',
        'type',
        'attachments',
        'demo_data',
    ];

    protected function casts(): array
    {
        return [
            'attachments' => 'array',
            'demo_data' => 'boolean',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(Task::class);
    }

    public function sourceComment(): BelongsTo
    {
        return $this->belongsTo(Comment::class, 'source_comment_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_id');
    }
}
