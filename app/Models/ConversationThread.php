<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class ConversationThread extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'contact_id',
        'campaign_id',
        'email_account_id',
        'subject',
        'status',
        'last_message_at',
    ];

    protected function casts(): array
    {
        return [
            'last_message_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(Campaign::class);
    }

    public function emailAccount(): BelongsTo
    {
        return $this->belongsTo(EmailAccount::class);
    }

    public function emailLogs(): HasMany
    {
        return $this->hasMany(EmailLog::class);
    }

    public function latestEmailLog(): HasOne
    {
        return $this->hasOne(EmailLog::class)->latestOfMany('id');
    }

    public function latestInboundEmailLog(): HasOne
    {
        return $this->hasOne(EmailLog::class)
            ->where('direction', 'inbound')
            ->latestOfMany('id');
    }
}
