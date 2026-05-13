<?php

namespace App\Services;

use App\Models\AnalyticsSnapshot;
use App\Models\Campaign;
use App\Models\EmailLog;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\Schema;

class AnalyticsService
{
    public function summaryForUser(User $user): array
    {
        if (! Schema::hasTable('email_logs')) {
            return [
                'totals' => [
                    'sent' => 0,
                    'delivery_rate' => 0,
                    'open_rate' => 0,
                    'click_rate' => 0,
                    'reply_rate' => 0,
                ],
                'timeline' => [],
                'campaigns' => [],
                'quick_mail' => [
                    'totals' => [
                        'sent' => 0,
                        'replies' => 0,
                        'bounces' => 0,
                        'reply_rate' => 0,
                    ],
                    'messages' => [],
                ],
            ];
        }

        $outboundLogs = EmailLog::query()
            ->where('user_id', $user->id)
            ->where('direction', 'outbound');

        $sent = (clone $outboundLogs)->where('event_type', 'sent')->count();
        $opened = (clone $outboundLogs)->whereNotNull('opened_at')->distinct('contact_id')->count('contact_id');
        $clicked = (clone $outboundLogs)->whereNotNull('clicked_at')->distinct('contact_id')->count('contact_id');
        $replied = EmailLog::query()->where('user_id', $user->id)->where('event_type', 'replied')->distinct('contact_id')->count('contact_id');
        $bounced = EmailLog::query()->where('user_id', $user->id)->where('event_type', 'bounced')->count();

        return [
            'totals' => [
                'sent' => $sent,
                'delivery_rate' => $this->rate(max($sent - $bounced, 0), $sent),
                'open_rate' => $this->rate($opened, $sent),
                'click_rate' => $this->rate($clicked, $sent),
                'reply_rate' => $this->rate($replied, $sent),
            ],
            'timeline' => $this->timelineForUser($user),
            'campaigns' => $this->campaignPerformance($user),
            'quick_mail' => $this->quickMailPerformance($user),
        ];
    }

    public function campaignPerformance(User $user): array
    {
        if (! Schema::hasTable('campaigns') || ! Schema::hasTable('email_logs')) {
            return [];
        }

        return Campaign::query()
            ->where('user_id', $user->id)
            ->withCount([
                'emailLogs as sent_count' => fn ($query) => $query->where('event_type', 'sent'),
                'emailLogs as reply_count' => fn ($query) => $query->where('event_type', 'replied'),
                'emailLogs as bounce_count' => fn ($query) => $query->where('event_type', 'bounced'),
            ])
            ->latest()
            ->take(6)
            ->get()
            ->map(fn (Campaign $campaign) => [
                'id' => $campaign->id,
                'name' => $campaign->name,
                'status' => $campaign->status,
                'sent' => $campaign->sent_count,
                'replies' => $campaign->reply_count,
                'bounces' => $campaign->bounce_count,
                'reply_rate' => $this->rate($campaign->reply_count, $campaign->sent_count),
            ])
            ->all();
    }

    public function timelineForUser(User $user, int $days = 14): array
    {
        if (! Schema::hasTable('email_logs')) {
            return [];
        }

        return collect(range($days - 1, 0))
            ->map(function (int $offset) use ($user): array {
                $date = Carbon::today()->subDays($offset);
                $query = EmailLog::query()
                    ->where('user_id', $user->id)
                    ->whereDate('created_at', $date);

                return [
                    'date' => $date->format('M d'),
                    'sent' => (clone $query)->where('event_type', 'sent')->count(),
                    'opened' => (clone $query)->whereNotNull('opened_at')->count(),
                    'clicked' => (clone $query)->whereNotNull('clicked_at')->count(),
                    'replied' => (clone $query)->where('event_type', 'replied')->count(),
                ];
            })
            ->all();
    }

    public function refreshCampaign(Campaign $campaign): void
    {
        if (! Schema::hasTable('analytics_snapshots') || ! Schema::hasTable('email_logs')) {
            return;
        }

        $sent = $campaign->emailLogs()->where('event_type', 'sent')->count();
        $opened = $campaign->emailLogs()->whereNotNull('opened_at')->count();
        $clicked = $campaign->emailLogs()->whereNotNull('clicked_at')->count();
        $replied = $campaign->emailLogs()->where('event_type', 'replied')->count();
        $bounced = $campaign->emailLogs()->where('event_type', 'bounced')->count();
        $unsubscribed = $campaign->emailLogs()->where('event_type', 'unsubscribed')->count();

        AnalyticsSnapshot::updateOrCreate(
            [
                'user_id' => $campaign->user_id,
                'campaign_id' => $campaign->id,
                'snapshot_date' => Carbon::today()->toDateString(),
            ],
            [
                'sent_count' => $sent,
                'delivered_count' => max($sent - $bounced, 0),
                'opened_count' => $opened,
                'clicked_count' => $clicked,
                'replied_count' => $replied,
                'bounced_count' => $bounced,
                'unsubscribed_count' => $unsubscribed,
            ],
        );
    }

    public function exportRows(User $user): array
    {
        $campaignRows = collect($this->campaignPerformance($user))
            ->map(fn (array $row) => [
                'type' => 'campaign',
                'campaign' => $row['name'],
                'status' => $row['status'],
                'sent' => $row['sent'],
                'replies' => $row['replies'],
                'bounces' => $row['bounces'],
                'reply_rate' => $row['reply_rate'],
            ]);

        $quickMailRows = collect($this->quickMailPerformance($user)['messages'] ?? [])
            ->map(fn (array $row) => [
                'type' => 'quick_mail',
                'campaign' => $row['contact_name'] ?: $row['recipient_email'],
                'status' => $row['status'],
                'sent' => $row['sent'],
                'replies' => $row['replies'],
                'bounces' => $row['bounces'],
                'reply_rate' => $row['reply_rate'],
            ]);

        return $campaignRows
            ->concat($quickMailRows)
            ->all();
    }

    public function quickMailPerformance(User $user): array
    {
        if (! Schema::hasTable('email_logs')) {
            return [
                'totals' => [
                    'sent' => 0,
                    'replies' => 0,
                    'bounces' => 0,
                    'reply_rate' => 0,
                ],
                'messages' => [],
            ];
        }

        $quickMailSent = EmailLog::query()
            ->where('user_id', $user->id)
            ->whereNull('campaign_id')
            ->where('direction', 'outbound')
            ->where('event_type', 'sent');

        $sent = (clone $quickMailSent)->count();
        $threadIds = (clone $quickMailSent)->whereNotNull('conversation_thread_id')->pluck('conversation_thread_id')->unique()->values();

        $replyLogs = EmailLog::query()
            ->where('user_id', $user->id)
            ->whereNull('campaign_id')
            ->where('event_type', 'replied')
            ->when($threadIds->isNotEmpty(), fn ($query) => $query->whereIn('conversation_thread_id', $threadIds));

        $bounceLogs = EmailLog::query()
            ->where('user_id', $user->id)
            ->whereNull('campaign_id')
            ->where('event_type', 'bounced')
            ->when($threadIds->isNotEmpty(), fn ($query) => $query->whereIn('conversation_thread_id', $threadIds));

        $messages = (clone $quickMailSent)
            ->with(['contact', 'thread'])
            ->latest('sent_at')
            ->take(25)
            ->get()
            ->map(function (EmailLog $log): array {
                $threadId = $log->conversation_thread_id;
                $replies = EmailLog::query()
                    ->where('user_id', $log->user_id)
                    ->whereNull('campaign_id')
                    ->where('event_type', 'replied')
                    ->when($threadId, fn ($query) => $query->where('conversation_thread_id', $threadId))
                    ->count();
                $bounces = EmailLog::query()
                    ->where('user_id', $log->user_id)
                    ->whereNull('campaign_id')
                    ->where('event_type', 'bounced')
                    ->when($threadId, fn ($query) => $query->where('conversation_thread_id', $threadId))
                    ->count();

                return [
                    'id' => $log->id,
                    'contact_name' => $log->contact?->full_name,
                    'recipient_email' => $log->recipient_email,
                    'subject' => $log->subject,
                    'sent_at' => $log->sent_at?->toIso8601String(),
                    'status' => $bounces > 0 ? 'bounced' : ($replies > 0 ? 'replied' : 'sent'),
                    'sent' => 1,
                    'replies' => $replies,
                    'bounces' => $bounces,
                    'reply_rate' => $this->rate($replies > 0 ? 1 : 0, 1),
                    'opened' => $log->opened_at !== null,
                    'clicked' => $log->clicked_at !== null,
                ];
            })
            ->all();

        return [
            'totals' => [
                'sent' => $sent,
                'replies' => $replyLogs->count(),
                'bounces' => $bounceLogs->count(),
                'reply_rate' => $this->rate($replyLogs->count(), $sent),
            ],
            'messages' => $messages,
        ];
    }

    private function rate(int $numerator, int $denominator): float
    {
        return $denominator === 0 ? 0 : round(($numerator / $denominator) * 100, 2);
    }
}
