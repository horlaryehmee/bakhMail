<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkspaceNotification extends Model
{
    use HasFactory;

    protected $table = 'notifications';

    protected $fillable = [
        'recipient_id',
        'title',
        'message',
        'entity_type',
        'entity_id',
        'project_id',
        'read_at',
        'metadata',
        'demo_data',
    ];

    protected function casts(): array
    {
        return [
            'read_at' => 'datetime',
            'metadata' => 'array',
            'demo_data' => 'boolean',
        ];
    }

    public function recipient(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recipient_id');
    }
}
