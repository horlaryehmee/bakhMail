<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Comment extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_id',
        'task_id',
        'reply_to_id',
        'author_id',
        'content',
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

    public function replyTo(): BelongsTo
    {
        return $this->belongsTo(Comment::class, 'reply_to_id');
    }

    public function replies(): HasMany
    {
        return $this->hasMany(Comment::class, 'reply_to_id');
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    public function mentions(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'comment_mentions');
    }

    public function sourcedRequests(): HasMany
    {
        return $this->hasMany(WorkspaceRequest::class, 'source_comment_id');
    }
}
