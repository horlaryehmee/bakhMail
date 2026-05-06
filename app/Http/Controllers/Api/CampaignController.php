<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Models\Campaign;
use App\Models\Contact;
use App\Services\ActivityLogger;
use App\Services\CampaignOrchestrator;
use App\Services\GroqService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class CampaignController extends Controller
{
    public function __construct(
        private readonly CampaignOrchestrator $orchestrator,
        private readonly ActivityLogger $activityLogger,
        private readonly GroqService $groqService,
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

    public function generate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'brief' => ['required', 'string', 'min:10', 'max:4000'],
            'campaign_name' => ['nullable', 'string', 'max:255'],
            'subject' => ['nullable', 'string', 'max:255'],
        ]);

        $model = $this->groqService->resolveResponseModel($this->setting('groq_response_model'));
        $result = $this->groqService->createResponse(
            $this->campaignGenerationPrompt($validated),
            $model,
            ['temperature' => 0.8],
            $request->user(),
        );

        try {
            $draft = $this->normalizeGeneratedDraft($this->extractJsonPayload($result['output_text'] ?? ''));
        } catch (\Throwable) {
            throw new RuntimeException('The AI response could not be turned into a campaign draft. Try again with a more specific brief.');
        }

        return response()->json([
            'data' => [
                'draft' => $draft,
                'model' => $result['model'] ?? $model,
                'usage' => $result['usage'] ?? null,
            ],
        ]);
    }

    public function assistDetails(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'brief' => ['nullable', 'string', 'max:4000'],
            'campaign_name' => ['nullable', 'string', 'max:255'],
            'subject' => ['nullable', 'string', 'max:255'],
            'preview_text' => ['nullable', 'string', 'max:255'],
            'builder_text' => ['nullable', 'string', 'max:8000'],
        ]);

        $model = $this->groqService->resolveResponseModel($this->setting('groq_response_model'));
        $result = $this->groqService->createResponse(
            $this->campaignDetailsAssistPrompt($validated),
            $model,
            ['temperature' => 0.7],
            $request->user(),
        );

        try {
            $details = $this->normalizeDetailsAssist($this->extractJsonPayload($result['output_text'] ?? ''));
        } catch (\Throwable) {
            throw new RuntimeException('The AI response could not be turned into campaign detail suggestions. Try again with a clearer brief.');
        }

        return response()->json([
            'data' => [
                'details' => $details,
                'model' => $result['model'] ?? $model,
                'usage' => $result['usage'] ?? null,
            ],
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

    private function setting(string $key): mixed
    {
        return AppSetting::query()->where('key', $key)->first()?->value;
    }

    private function campaignGenerationPrompt(array $validated): string
    {
        $campaignName = $validated['campaign_name'] ?? '';
        $subject = $validated['subject'] ?? '';
        $brief = $validated['brief'];

        return <<<PROMPT
You are generating a B2B email campaign draft for a visual campaign builder.

Return valid JSON only. No markdown fences. No explanation.

JSON shape:
{
  "name": "string",
  "subject": "string",
  "preview_text": "string",
  "builder_blocks": [
    {
      "type": "image|text|button|divider"
    }
  ],
  "steps": [
    {
      "name": "string",
      "subject": "string",
      "delay_hours": 0,
      "body_html": "<p>...</p>"
    }
  ]
}

Rules:
- Tone should be modern, credible, concise, and human.
- Use placeholders like {{first_name}} and {{company}} when useful.
- Include at least one text block and one button block.
- Image URLs should come from https://images.unsplash.com
- text block fields: type, content, align, color, fontSize, paddingTop, paddingBottom
- image block fields: type, src, alt, paddingTop, paddingBottom
- button block fields: type, label, href, align, backgroundColor, textColor, paddingTop, paddingBottom
- divider block fields: type, color, paddingTop, paddingBottom
- Produce 2 or 3 sequence steps.
- step body_html must be simple valid email HTML.

Current campaign hints:
- campaign_name: {$campaignName}
- subject: {$subject}

User brief:
{$brief}
PROMPT;
    }

    private function campaignDetailsAssistPrompt(array $validated): string
    {
        $campaignName = $validated['campaign_name'] ?? '';
        $subject = $validated['subject'] ?? '';
        $previewText = $validated['preview_text'] ?? '';
        $brief = $validated['brief'] ?? '';
        $builderText = $validated['builder_text'] ?? '';

        return <<<PROMPT
You are helping finalize the settings and scheduling step of a B2B outreach campaign builder.

Return valid JSON only. No markdown fences. No commentary.

JSON shape:
{
  "campaign_name": "string",
  "subject": "string",
  "preview_text": "string",
  "audience_strategy": "short recommendation",
  "send_strategy": "short recommendation",
  "quality_note": "short quality note"
}

Rules:
- Keep subject under 60 characters.
- Keep preview_text under 120 characters.
- Make the output practical and easy to apply.
- The copy should fit a credible B2B outbound campaign.
- Use the current email draft and brief as context.

Current inputs:
- campaign_name: {$campaignName}
- subject: {$subject}
- preview_text: {$previewText}
- email draft text: {$builderText}
- user brief: {$brief}
PROMPT;
    }

    private function extractJsonPayload(string $output): array
    {
        $output = trim($output);
        $decoded = json_decode($output, true);

        if (is_array($decoded)) {
            return $decoded;
        }

        $start = strpos($output, '{');
        $end = strrpos($output, '}');

        if ($start === false || $end === false || $end <= $start) {
            throw new RuntimeException('No JSON object was returned.');
        }

        $decoded = json_decode(substr($output, $start, $end - $start + 1), true);

        if (! is_array($decoded)) {
            throw new RuntimeException('Invalid JSON returned.');
        }

        return $decoded;
    }

    private function normalizeGeneratedDraft(array $draft): array
    {
        $blocks = collect($draft['builder_blocks'] ?? [])
            ->map(function ($block, $index) {
                $type = $block['type'] ?? 'text';
                $base = [
                    'id' => "ai-block-{$index}-".substr(md5(json_encode($block)), 0, 10),
                    'type' => $type,
                    'paddingTop' => (int) ($block['paddingTop'] ?? 12),
                    'paddingBottom' => (int) ($block['paddingBottom'] ?? 12),
                ];

                return match ($type) {
                    'image' => [
                        ...$base,
                        'src' => (string) ($block['src'] ?? 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80'),
                        'alt' => (string) ($block['alt'] ?? 'Campaign image'),
                    ],
                    'button' => [
                        ...$base,
                        'label' => (string) ($block['label'] ?? 'Learn more'),
                        'href' => (string) ($block['href'] ?? 'https://example.com'),
                        'align' => $this->normalizeAlign($block['align'] ?? 'left'),
                        'backgroundColor' => (string) ($block['backgroundColor'] ?? '#171411'),
                        'textColor' => (string) ($block['textColor'] ?? '#fffaf3'),
                    ],
                    'divider' => [
                        ...$base,
                        'color' => (string) ($block['color'] ?? '#ddd3c4'),
                    ],
                    default => [
                        ...$base,
                        'content' => (string) ($block['content'] ?? 'Generated campaign copy.'),
                        'align' => $this->normalizeAlign($block['align'] ?? 'left'),
                        'color' => (string) ($block['color'] ?? '#201a16'),
                        'fontSize' => (int) ($block['fontSize'] ?? 17),
                    ],
                };
            })
            ->values()
            ->all();

        if ($blocks === []) {
            $blocks = [[
                'id' => 'ai-block-fallback',
                'type' => 'text',
                'content' => 'Generated campaign copy.',
                'align' => 'left',
                'color' => '#201a16',
                'fontSize' => 17,
                'paddingTop' => 16,
                'paddingBottom' => 16,
            ]];
        }

        $steps = collect($draft['steps'] ?? [])
            ->map(fn ($step, $index) => [
                'id' => "ai-step-{$index}",
                'name' => (string) ($step['name'] ?? 'Follow-up '.($index + 1)),
                'subject' => (string) ($step['subject'] ?? ($draft['subject'] ?? 'Quick question')),
                'delay_hours' => (int) ($step['delay_hours'] ?? ($index === 0 ? 0 : 48)),
                'body_html' => (string) ($step['body_html'] ?? '<p>Hi {{first_name}},</p><p>Following up on my earlier note.</p>'),
            ])
            ->take(3)
            ->values()
            ->all();

        return [
            'name' => (string) ($draft['name'] ?? 'AI campaign draft'),
            'subject' => (string) ($draft['subject'] ?? 'Quick question for {{company}}'),
            'preview_text' => (string) ($draft['preview_text'] ?? ''),
            'builder_blocks' => $blocks,
            'steps' => $steps,
        ];
    }

    private function normalizeDetailsAssist(array $details): array
    {
        return [
            'campaign_name' => mb_substr((string) ($details['campaign_name'] ?? ''), 0, 255),
            'subject' => mb_substr((string) ($details['subject'] ?? ''), 0, 255),
            'preview_text' => mb_substr((string) ($details['preview_text'] ?? ''), 0, 255),
            'audience_strategy' => mb_substr((string) ($details['audience_strategy'] ?? ''), 0, 400),
            'send_strategy' => mb_substr((string) ($details['send_strategy'] ?? ''), 0, 400),
            'quality_note' => mb_substr((string) ($details['quality_note'] ?? ''), 0, 400),
        ];
    }

    private function normalizeAlign(mixed $align): string
    {
        return in_array($align, ['left', 'center', 'right'], true) ? $align : 'left';
    }
}
