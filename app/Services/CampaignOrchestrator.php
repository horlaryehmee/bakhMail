<?php

namespace App\Services;

use App\Jobs\SendCampaignStepJob;
use App\Models\Campaign;
use App\Models\CampaignRecipient;
use App\Models\CampaignStep;
use App\Models\Contact;
use App\Models\EmailAccount;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class CampaignOrchestrator
{
    public function __construct(
        private readonly PlaceholderService $placeholders,
        private readonly ActivityLogger $activityLogger,
    ) {
    }

    public function saveSteps(Campaign $campaign, array $steps): void
    {
        $stepIds = [];

        foreach (collect($steps)->values() as $index => $step) {
            $model = CampaignStep::updateOrCreate(
                [
                    'campaign_id' => $campaign->id,
                    'step_order' => $step['step_order'] ?? ($index + 1),
                ],
                [
                    'name' => $step['name'] ?? 'Step '.($index + 1),
                    'subject' => $step['subject'] ?? $campaign->subject,
                    'body_html' => $step['body_html'] ?? $campaign->template_html,
                    'body_text' => $step['body_text'] ?? $campaign->template_text,
                    'delay_hours' => $step['delay_hours'] ?? 0,
                    'send_window' => $step['send_window'] ?? null,
                    'stop_on_reply' => $step['stop_on_reply'] ?? true,
                    'stop_on_click' => $step['stop_on_click'] ?? false,
                    'conditions' => $step['conditions'] ?? null,
                ],
            );

            $stepIds[] = $model->id;
        }

        $campaign->steps()->whereNotIn('id', $stepIds)->delete();
    }

    public function renderPreview(Campaign $campaign, ?Contact $contact = null): array
    {
        $account = $campaign->user->emailAccounts()->whereIn('id', $campaign->selected_email_account_ids ?? [])->first()
            ?? $campaign->user->emailAccounts()->first()
            ?? new EmailAccount([
                'name' => 'BakhMail',
                'from_name' => $campaign->user->name,
                'email_address' => $campaign->user->email,
            ]);

        $contact ??= $campaign->user->contacts()->first() ?? new Contact([
            'first_name' => 'Jordan',
            'last_name' => 'Lee',
            'email' => 'jordan@example.com',
            'company' => 'Acme',
            'job_title' => 'Head of Growth',
        ]);

        $html = $this->placeholders->render($campaign->template_html, $contact, $campaign, $account);
        $subject = $this->placeholders->render($campaign->subject, $contact, $campaign, $account);

        return compact('subject', 'html');
    }

    public function queueCampaign(Campaign $campaign): array
    {
        $steps = $campaign->steps()->get();
        $contacts = $this->resolveContacts($campaign);
        $accounts = $campaign->user->emailAccounts()
            ->where('status', 'active')
            ->when(
                filled($campaign->selected_email_account_ids),
                fn ($query) => $query->whereIn('id', $campaign->selected_email_account_ids),
            )
            ->get();

        if ($steps->isEmpty()) {
            throw ValidationException::withMessages(['steps' => 'Campaigns must have at least one sequence step.']);
        }

        if ($contacts->isEmpty()) {
            throw ValidationException::withMessages(['audience_filters' => 'No contacts matched the selected audience.']);
        }

        if ($accounts->isEmpty()) {
            throw ValidationException::withMessages(['selected_email_account_ids' => 'Attach at least one active sending account.']);
        }

        $campaign->recipients()->whereNotIn('contact_id', $contacts->pluck('id'))->delete();

        $accounts = $accounts->values();
        $dispatchAt = $campaign->scheduled_at ?: now();

        foreach ($contacts->values() as $index => $contact) {
            CampaignRecipient::updateOrCreate(
                [
                    'campaign_id' => $campaign->id,
                    'contact_id' => $contact->id,
                ],
                [
                    'email_account_id' => $accounts[$index % $accounts->count()]->id,
                    'status' => 'queued',
                    'scheduled_for' => $dispatchAt,
                ],
            );
        }

        $campaign->forceFill([
            'total_recipients' => $contacts->count(),
            'status' => $campaign->scheduled_at && $campaign->scheduled_at->isFuture() ? 'scheduled' : 'queued',
        ])->save();

        if (! $campaign->scheduled_at || $campaign->scheduled_at->isPast()) {
            $this->dispatchInitialStepJobs($campaign);
        }

        return [
            'contacts' => $contacts->count(),
            'accounts' => $accounts->count(),
            'status' => $campaign->status,
        ];
    }

    public function dispatchDueCampaigns(): int
    {
        $count = 0;

        Campaign::query()
            ->where('status', 'scheduled')
            ->whereNotNull('scheduled_at')
            ->where('scheduled_at', '<=', now())
            ->each(function (Campaign $campaign) use (&$count): void {
                $this->dispatchInitialStepJobs($campaign);
                $count++;
            });

        return $count;
    }

    public function queueNextStep(CampaignRecipient $recipient): void
    {
        $nextStep = $recipient->campaign->steps()
            ->where('step_order', '>', $recipient->current_step_order)
            ->first();

        if (! $nextStep) {
            $recipient->update([
                'status' => 'completed',
                'completed_at' => now(),
            ]);

            return;
        }

        SendCampaignStepJob::dispatch($recipient->id, $nextStep->id)
            ->delay(now()->addHours($nextStep->delay_hours));
    }

    private function dispatchInitialStepJobs(Campaign $campaign): void
    {
        $firstStep = $campaign->steps()->orderBy('step_order')->first();

        if (! $firstStep) {
            return;
        }

        $campaign->recipients()
            ->where('status', 'queued')
            ->whereNull('last_sent_at')
            ->get()
            ->each(function (CampaignRecipient $recipient) use ($firstStep, $campaign): void {
                SendCampaignStepJob::dispatch($recipient->id, $firstStep->id)
                    ->delay($recipient->scheduled_for ?: now());

                $recipient->update(['status' => 'scheduled']);
            });

        $campaign->update([
            'status' => 'active',
            'started_at' => $campaign->started_at ?: now(),
        ]);
    }

    private function resolveContacts(Campaign $campaign): Collection
    {
        $filters = $campaign->audience_filters ?? [];

        return $campaign->user->contacts()
            ->where('status', $filters['status'] ?? 'active')
            ->when(
                filled($filters['group_ids'] ?? []),
                fn ($query) => $query->whereHas('groups', fn ($groupQuery) => $groupQuery->whereIn('contact_groups.id', $filters['group_ids'])),
            )
            ->when(
                filled($filters['tag_ids'] ?? []),
                fn ($query) => $query->whereHas('tags', fn ($tagQuery) => $tagQuery->whereIn('tags.id', $filters['tag_ids'])),
            )
            ->when(
                filled($filters['search'] ?? null),
                fn ($query) => $query->where(function ($searchQuery) use ($filters): void {
                    $searchQuery
                        ->where('email', 'like', '%'.$filters['search'].'%')
                        ->orWhere('company', 'like', '%'.$filters['search'].'%')
                        ->orWhere('first_name', 'like', '%'.$filters['search'].'%')
                        ->orWhere('last_name', 'like', '%'.$filters['search'].'%');
                }),
            )
            ->whereNull('unsubscribed_at')
            ->whereNull('bounced_at')
            ->get();
    }
}
