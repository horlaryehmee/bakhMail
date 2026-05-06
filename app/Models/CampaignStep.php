<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CampaignStep extends Model
{
    use HasFactory;

    protected $fillable = [
        'campaign_id',
        'name',
        'step_order',
        'subject',
        'body_html',
        'body_text',
        'delay_hours',
        'send_window',
        'stop_on_reply',
        'stop_on_click',
        'conditions',
    ];

    protected function casts(): array
    {
        return [
            'send_window' => 'array',
            'stop_on_reply' => 'boolean',
            'stop_on_click' => 'boolean',
            'conditions' => 'array',
        ];
    }

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(Campaign::class);
    }

    public function emailLogs(): HasMany
    {
        return $this->hasMany(EmailLog::class);
    }
}
