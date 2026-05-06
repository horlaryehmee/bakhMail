<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EmailAccount extends Model
{
    use HasFactory;

    protected $hidden = [
        'smtp_password',
        'imap_password',
        'oauth_access_token',
        'oauth_refresh_token',
    ];

    protected $fillable = [
        'user_id',
        'name',
        'from_name',
        'email_address',
        'reply_to_address',
        'provider',
        'status',
        'smtp_host',
        'smtp_port',
        'smtp_encryption',
        'smtp_username',
        'smtp_password',
        'imap_host',
        'imap_port',
        'imap_encryption',
        'imap_username',
        'imap_password',
        'oauth_provider',
        'oauth_access_token',
        'oauth_refresh_token',
        'oauth_expires_at',
        'warmup_enabled',
        'warmup_target_email',
        'daily_limit',
        'hourly_limit',
        'health_score',
        'last_synced_at',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'smtp_password' => 'encrypted',
            'imap_password' => 'encrypted',
            'oauth_access_token' => 'encrypted',
            'oauth_refresh_token' => 'encrypted',
            'oauth_expires_at' => 'datetime',
            'warmup_enabled' => 'boolean',
            'last_synced_at' => 'datetime',
            'metadata' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function emailLogs(): HasMany
    {
        return $this->hasMany(EmailLog::class);
    }

    public function campaignRecipients(): HasMany
    {
        return $this->hasMany(CampaignRecipient::class);
    }

    public function conversationThreads(): HasMany
    {
        return $this->hasMany(ConversationThread::class);
    }

    public function hasImapConfiguration(): bool
    {
        return filled($this->imap_host) && filled($this->imap_port) && filled($this->imap_username);
    }
}
