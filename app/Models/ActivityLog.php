<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ActivityLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'actor_id',
        'action',
        'message',
        'entity_type',
        'entity_id',
        'project_id',
        'task_id',
        'metadata',
        'demo_data',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'demo_data' => 'boolean',
        ];
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
