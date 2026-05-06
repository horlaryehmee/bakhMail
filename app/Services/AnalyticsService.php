<?php

namespace App\Services;

use App\Models\AnalyticsSnapshot;
use App\Models\Campaign;
use App\Models\EmailLog;
use App\Models\User;
use Carbon\Carbon;

class AnalyticsService
{
    public function summaryForUser(User $user): array
    {
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
        ];
    }

    public function campaignPerformance(User $user): array
    {
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
        return collect($this->campaignPerformance($user))
            ->map(fn (array $row) => [
                'campaign' => $row['name'],
                'status' => $row['status'],
                'sent' => $row['sent'],
                'replies' => $row['replies'],
                'bounces' => $row['bounces'],
                'reply_rate' => $row['reply_rate'],
            ])
            ->all();
    }

    private function rate(int $numerator, int $denominator): float
    {
        return $denominator === 0 ? 0 : round(($numerator / $denominator) * 100, 2);
    }
}
