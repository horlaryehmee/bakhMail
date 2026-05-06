<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AnalyticsSnapshot extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'campaign_id',
        'snapshot_date',
        'sent_count',
        'delivered_count',
        'opened_count',
        'clicked_count',
        'replied_count',
        'bounced_count',
        'unsubscribed_count',
    ];

    protected function casts(): array
    {
        return [
            'snapshot_date' => 'date',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(Campaign::class);
    }
}
