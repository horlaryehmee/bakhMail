<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Campaign;
use App\Models\Contact;
use App\Services\ActivityLogger;
use App\Services\CampaignOrchestrator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CampaignController extends Controller
{
    public function __construct(
        private readonly CampaignOrchestrator $orchestrator,
        private readonly ActivityLogger $activityLogger,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $campaigns = $request->user()->campaigns()
            ->withCount(['steps', 'recipients', 'emailLogs as sent_count' => fn ($query) => $query->where('event_type', 'sent')])
            ->latest()
            ->get();

        return response()->json([
            'data' => $campaigns->map(fn (Campaign $campaign) => $this->serializeCampaign($campaign))->all(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $this->validatePayload($request);
        $campaign = $request->user()->campaigns()->create($validated);
        $this->orchestrator->saveSteps($campaign, $request->input('steps', []));

        $campaign->loadCount(['steps', 'recipients']);
        $this->activityLogger->log($request->user(), 'campaigns.created', $campaign, $request, description: "Created campaign {$campaign->name}.");

        return response()->json(['data' => $this->serializeCampaign($campaign)], 201);
    }

    public function show(Request $request, Campaign $campaign): JsonResponse
    {
        abort_unless($campaign->user_id === $request->user()->id, 404);
        $campaign->load(['steps', 'recipients.contact', 'emailLogs' => fn ($query) => $query->latest()->limit(25)]);
        $preview = $this->orchestrator->renderPreview($campaign, $campaign->user->contacts()->first());

        return response()->json([
            'data' => array_merge($this->serializeCampaign($campaign, true), ['preview' => $preview]),
        ]);
    }

    public function update(Request $request, Campaign $campaign): JsonResponse
    {
        abort_unless($campaign->user_id === $request->user()->id, 404);
        $validated = $this->validatePayload($request);

        $campaign->update($validated);
        $this->orchestrator->saveSteps($campaign, $request->input('steps', []));
        $campaign->loadCount(['steps', 'recipients']);

        $this->activityLogger->log($request->user(), 'campaigns.updated', $campaign, $request, description: "Updated campaign {$campaign->name}.");

        return response()->json(['data' => $this->serializeCampaign($campaign)]);
    }

    public function destroy(Request $request, Campaign $campaign): JsonResponse
    {
        abort_unless($campaign->user_id === $request->user()->id, 404);
        $name = $campaign->name;
        $campaign->delete();

        $this->activityLogger->log($request->user(), 'campaigns.deleted', Campaign::class, $request, ['name' => $name], "Deleted campaign {$name}.");

        return response()->json(['status' => 'deleted']);
    }

    public function launch(Request $request, Campaign $campaign): JsonResponse
    {
        abort_unless($campaign->user_id === $request->user()->id, 404);
        $result = $this->orchestrator->queueCampaign($campaign->fresh('steps'));

        $this->activityLogger->log($request->user(), 'campaigns.launched', $campaign, $request, $result, "Queued campaign {$campaign->name}.");

        return response()->json(['data' => $result]);
    }

    public function preview(Request $request, Campaign $campaign): JsonResponse
    {
        abort_unless($campaign->user_id === $request->user()->id, 404);

        $contact = $request->filled('contact_id')
            ? Contact::query()->where('user_id', $request->user()->id)->find($request->integer('contact_id'))
            : null;

        return response()->json([
            'data' => $this->orchestrator->renderPreview($campaign, $contact),
        ]);
    }

    private function validatePayload(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'subject' => ['required', 'string', 'max:255'],
            'preview_text' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'string', 'max:50'],
            'builder_type' => ['nullable', 'string', 'max:50'],
            'audience_filters' => ['nullable', 'array'],
            'template_html' => ['required', 'string'],
            'template_text' => ['nullable', 'string'],
            'settings' => ['nullable', 'array'],
            'selected_email_account_ids' => ['nullable', 'array'],
            'selected_email_account_ids.*' => ['integer'],
            'scheduled_at' => ['nullable', 'date'],
        ]);
    }

    private function serializeCampaign(Campaign $campaign, bool $detailed = false): array
    {
        $payload = [
            'id' => $campaign->id,
            'name' => $campaign->name,
            'subject' => $campaign->subject,
            'preview_text' => $campaign->preview_text,
            'status' => $campaign->status,
            'builder_type' => $campaign->builder_type,
            'audience_filters' => array_merge([
                'search' => '',
                'group_ids' => [],
                'tag_ids' => [],
                'status' => 'active',
            ], $campaign->audience_filters ?? []),
            'template_html' => $campaign->template_html,
            'template_text' => $campaign->template_text,
            'settings' => $campaign->settings ?? [],
            'selected_email_account_ids' => $campaign->selected_email_account_ids ?? [],
            'total_recipients' => $campaign->total_recipients,
            'scheduled_at' => $campaign->scheduled_at?->toIso8601String(),
            'started_at' => $campaign->started_at?->toIso8601String(),
            'completed_at' => $campaign->completed_at?->toIso8601String(),
            'steps_count' => $campaign->steps_count ?? $campaign->steps->count(),
            'recipients_count' => $campaign->recipients_count ?? $campaign->recipients->count(),
            'sent_count' => $campaign->sent_count ?? 0,
        ];

        if ($detailed) {
            $payload['steps'] = $campaign->steps->map(fn ($step) => [
                'id' => $step->id,
                'name' => $step->name,
                'step_order' => $step->step_order,
                'subject' => $step->subject,
                'body_html' => $step->body_html,
                'body_text' => $step->body_text,
                'delay_hours' => $step->delay_hours,
                'send_window' => $step->send_window,
                'stop_on_reply' => $step->stop_on_reply,
                'stop_on_click' => $step->stop_on_click,
                'conditions' => $step->conditions,
            ])->all();

            $payload['recipients'] = $campaign->recipients->map(fn ($recipient) => [
                'id' => $recipient->id,
                'status' => $recipient->status,
                'current_step_order' => $recipient->current_step_order,
                'last_sent_at' => $recipient->last_sent_at?->toIso8601String(),
                'contact' => [
                    'id' => $recipient->contact?->id,
                    'name' => $recipient->contact?->full_name,
                    'email' => $recipient->contact?->email,
                ],
            ])->all();

            $payload['email_logs'] = $campaign->emailLogs->map(fn ($log) => [
                'id' => $log->id,
                'event_type' => $log->event_type,
                'subject' => $log->subject,
                'recipient_email' => $log->recipient_email,
                'sent_at' => $log->sent_at?->toIso8601String(),
            ])->all();
        }

        return $payload;
    }
}
