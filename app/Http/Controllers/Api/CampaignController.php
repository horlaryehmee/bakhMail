<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Models\Campaign;
use App\Models\Contact;
use App\Models\EmailAccount;
use App\Services\ActivityLogger;
use App\Services\CampaignOrchestrator;
use App\Services\DynamicSmtpMailer;
use App\Services\GroqService;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use RuntimeException;

class CampaignController extends Controller
{
    private const MAX_AI_BRIEF_CHARS = 1600;

    public function __construct(
        private readonly CampaignOrchestrator $orchestrator,
        private readonly ActivityLogger $activityLogger,
        private readonly DynamicSmtpMailer $dynamicSmtpMailer,
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

    public function testDraft(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'to_email' => ['nullable', 'email'],
            'selected_email_account_ids' => ['required', 'array', 'min:1'],
            'selected_email_account_ids.*' => ['integer'],
            'subject' => ['required', 'string', 'max:255'],
            'template_html' => ['required', 'string'],
            'template_text' => ['nullable', 'string'],
            'steps' => ['nullable', 'array'],
            'steps.*.id' => ['nullable'],
            'steps.*.name' => ['nullable', 'string', 'max:255'],
            'steps.*.subject' => ['nullable', 'string', 'max:255'],
            'steps.*.body_html' => ['nullable', 'string'],
            'message_target' => ['nullable', 'string', 'max:100'],
        ]);

        $account = $request->user()->emailAccounts()
            ->whereIn('id', $validated['selected_email_account_ids'])
            ->first();

        if (! $account instanceof EmailAccount) {
            throw new RuntimeException('Choose at least one sending mailbox before sending a test email.');
        }

        $messageTarget = (string) ($validated['message_target'] ?? 'opening');
        [$subject, $html, $text] = $this->resolveDraftTestMessage($validated, $messageTarget, $request);
        $to = $validated['to_email'] ?? $request->user()->email;

        $result = $this->dynamicSmtpMailer->send($account, [
            'to' => $to,
            'subject' => $subject,
            'html' => $html,
            'text' => $text,
        ]);

        $this->activityLogger->log(
            $request->user(),
            'campaigns.tested',
            Campaign::class,
            $request,
            ['to' => $to, 'message_target' => $messageTarget, 'email_account_id' => $account->id],
            "Sent a campaign test email to {$to}."
        );

        return response()->json([
            'status' => 'sent',
            'message_id' => $result['message_id'] ?? null,
        ]);
    }

    public function generate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'brief' => ['required', 'string', 'min:10', 'max:5000'],
            'campaign_name' => ['nullable', 'string', 'max:255'],
            'subject' => ['nullable', 'string', 'max:255'],
        ]);

        $validated['brief'] = $this->normalizeAiBrief($validated['brief']);
        $model = $this->groqService->resolveResponseModel($this->setting('groq_response_model'));
        $result = $this->generateCampaignDraftResponse($validated, $model, $request);

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

    public function builderTemplate(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->savedBuilderTemplate($request->user()->id),
        ]);
    }

    public function saveBuilderTemplate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'header' => ['nullable', 'array'],
            'footer' => ['nullable', 'array'],
            'auto_apply' => ['nullable', 'boolean'],
        ]);

        AppSetting::updateOrCreate(
            ['key' => $this->builderTemplateSettingKey($request->user()->id)],
            [
                'value' => [
                    'header' => $this->normalizeTemplateBlock($validated['header'] ?? null, 'header'),
                    'footer' => $this->normalizeTemplateBlock($validated['footer'] ?? null, 'footer'),
                    'auto_apply' => (bool) ($validated['auto_apply'] ?? false),
                ],
                'updated_by' => $request->user()->id,
            ]
        );

        return response()->json([
            'data' => $this->savedBuilderTemplate($request->user()->id),
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

    private function resolveDraftTestMessage(array $validated, string $messageTarget, Request $request): array
    {
        $subject = (string) $validated['subject'];
        $html = (string) $validated['template_html'];
        $text = (string) ($validated['template_text'] ?? strip_tags($html));

        if (str_starts_with($messageTarget, 'step:')) {
            $targetId = substr($messageTarget, 5);
            $step = collect($validated['steps'] ?? [])->first(fn ($candidate) => (string) ($candidate['id'] ?? '') === $targetId);

            if (is_array($step)) {
                $subject = (string) ($step['subject'] ?? $subject);
                $html = (string) ($step['body_html'] ?? $html);
                $text = strip_tags($html);
            }
        }

        return [
            $this->replaceDraftPlaceholders($subject, $request),
            $this->replaceDraftPlaceholders($html, $request),
            $this->replaceDraftPlaceholders($text, $request),
        ];
    }

    private function replaceDraftPlaceholders(string $content, Request $request): string
    {
        $userName = trim((string) $request->user()->name);
        $firstName = $userName !== '' ? explode(' ', $userName)[0] : 'there';

        return str_replace(
            ['{{first_name}}', '{{company}}', '{{job_title}}', '{{location}}', '{{Name}}'],
            [$firstName, 'your company', 'your role', 'your area', $firstName],
            $content
        );
    }

    private function setting(string $key): mixed
    {
        return AppSetting::query()->where('key', $key)->first()?->value;
    }

    private function savedBuilderTemplate(int $userId): array
    {
        $value = AppSetting::query()->where('key', $this->builderTemplateSettingKey($userId))->first()?->value;

        return [
            'header' => $this->normalizeTemplateBlock(data_get($value, 'header'), 'header'),
            'footer' => $this->normalizeTemplateBlock(data_get($value, 'footer'), 'footer'),
            'auto_apply' => (bool) data_get($value, 'auto_apply', false),
        ];
    }

    private function campaignGenerationPrompt(array $validated): string
    {
        $campaignName = $validated['campaign_name'] ?? '';
        $subject = $validated['subject'] ?? '';
        $brief = $validated['brief'];

        return <<<PROMPT
Create a B2B outreach campaign draft for a visual email builder.
Return valid JSON only with this shape:
{"name":"","subject":"","preview_text":"","builder_blocks":[],"steps":[]}

Rules:
- Stay tightly anchored to the user brief.
- Do not invent features, claims, proof, pricing, or audience pain points not supported by the brief.
- Opening email: 140-260 words, multiple short paragraphs, human and specific.
- Default to a plain cold email layout, not a designed newsletter.
- Do not include a decorative header section.
- Do not include image blocks unless the brief explicitly asks for an image.
- Include a hook, value proposition, and CTA.
- Provide a simple builder flow with 2 text blocks, 1 button block, and 1 footer-style text block.
- Allowed block types: text, button, divider, image.
- Text block fields: type, content, align, color, fontSize, paddingTop, paddingBottom.
- Image block fields: type, src, alt, paddingTop, paddingBottom. Use only https://images.unsplash.com URLs.
- Button block fields: type, label, href, align, backgroundColor, textColor, paddingTop, paddingBottom.
- Divider block fields: type, color, paddingTop, paddingBottom.
- Provide 2 or 3 steps.
- Step fields: name, subject, delay_hours, body_html.
- First step body_html must be simple valid email HTML with multiple paragraphs.
- Follow-up steps should be shorter but still complete.
- Avoid spammy formatting, aggressive urgency, excessive punctuation, all caps, exaggerated claims, or clickbait subject lines.
- Prefer natural language, modest claims, and one clear CTA.

Campaign hints:
- campaign_name: {$campaignName}
- subject: {$subject}

User brief:
{$brief}
PROMPT;
    }

    private function compactCampaignGenerationPrompt(array $validated): string
    {
        $campaignName = $validated['campaign_name'] ?? '';
        $subject = $validated['subject'] ?? '';
        $brief = $validated['brief'];

        return <<<PROMPT
Return valid JSON only:
{"name":"","subject":"","preview_text":"","builder_blocks":[],"steps":[]}

Write a B2B cold email campaign that follows the brief exactly.
- No invented features or claims.
- Opening email: 120-220 words, multiple short paragraphs, clear CTA.
- Use a plain cold email structure with text-first content and one CTA button.
- Do not include a decorative header or image unless the brief asks for one.
- 2 text blocks minimum and 1 button block minimum.
- 2 steps total.
- step fields: name, subject, delay_hours, body_html.
- builder_blocks use only: image, text, button, divider.

campaign_name: {$campaignName}
subject: {$subject}
brief: {$brief}
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

        if ($this->builderBlocksNeedExpansion($blocks)) {
            $blocks = $this->expandBuilderBlocksFromSteps($blocks, $steps);
        }

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

    private function builderBlocksNeedExpansion(array $blocks): bool
    {
        $textBlocks = collect($blocks)->where('type', 'text')->values();
        $textWordCount = str_word_count($textBlocks->pluck('content')->implode(' '));

        return $textBlocks->count() < 2 || $textWordCount < 60;
    }

    private function expandBuilderBlocksFromSteps(array $blocks, array $steps): array
    {
        $firstStepHtml = (string) ($steps[0]['body_html'] ?? '');
        $paragraphs = $this->extractParagraphsFromHtml($firstStepHtml);

        if ($paragraphs === []) {
            return $blocks;
        }

        $rebuiltTextBlocks = collect($paragraphs)
            ->take(4)
            ->values()
            ->map(function (string $paragraph, int $index) {
                return [
                    'id' => "ai-rebuilt-text-{$index}",
                    'type' => 'text',
                    'content' => $paragraph,
                    'align' => 'left',
                    'color' => '#201a16',
                    'fontSize' => $index === 0 ? 18 : 17,
                    'paddingTop' => $index === 0 ? 20 : 12,
                    'paddingBottom' => 12,
                ];
            })
            ->all();

        $nonTextBlocks = collect($blocks)
            ->reject(fn ($block) => ($block['type'] ?? null) === 'text')
            ->values();

        $buttonBlocks = $nonTextBlocks->filter(fn ($block) => ($block['type'] ?? null) === 'button');

        if ($buttonBlocks->isEmpty()) {
            $nonTextBlocks->push([
                'id' => 'ai-rebuilt-button',
                'type' => 'button',
                'label' => 'Book a call',
                'href' => 'https://example.com',
                'align' => 'left',
                'backgroundColor' => '#171411',
                'textColor' => '#fffaf3',
                'paddingTop' => 12,
                'paddingBottom' => 12,
            ]);
        }

        return collect()
            ->merge($nonTextBlocks->take(1))
            ->merge($rebuiltTextBlocks)
            ->merge($nonTextBlocks->skip(1))
            ->values()
            ->all();
    }

    private function extractParagraphsFromHtml(string $html): array
    {
        if (trim($html) === '') {
            return [];
        }

        $text = preg_replace('/<(br|\\/p)\\s*\\/?>/i', "\n", $html) ?? $html;
        $text = preg_replace('/<\\/div\\s*>/i', "\n", $text) ?? $text;
        $text = strip_tags($text);
        $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = str_replace(["\r\n", "\r"], "\n", $text);
        $text = preg_replace("/\n{3,}/", "\n\n", $text) ?? $text;

        return collect(preg_split("/\n\s*\n/", $text) ?: [])
            ->map(fn ($paragraph) => trim((string) $paragraph))
            ->map(fn ($paragraph) => preg_replace('/\s+/', ' ', $paragraph) ?? $paragraph)
            ->filter(fn ($paragraph) => $paragraph !== '' && Str::length($paragraph) >= 25)
            ->values()
            ->all();
    }

    private function normalizeAiBrief(string $brief): string
    {
        $brief = trim($brief);
        $brief = preg_replace('/\s+/', ' ', $brief) ?? $brief;

        if (Str::length($brief) <= self::MAX_AI_BRIEF_CHARS) {
            return $brief;
        }

        return trim(Str::limit($brief, self::MAX_AI_BRIEF_CHARS, ''));
    }

    private function builderTemplateSettingKey(int $userId): string
    {
        return "campaign_builder_template_user_{$userId}";
    }

    private function normalizeTemplateBlock(mixed $block, string $type): ?array
    {
        if (! is_array($block)) {
            return null;
        }

        if (($block['type'] ?? null) !== $type) {
            $block['type'] = $type;
        }

        if ($type === 'header') {
            return [
                'type' => 'header',
                'logoText' => mb_substr((string) ($block['logoText'] ?? ''), 0, 12),
                'eyebrow' => mb_substr((string) ($block['eyebrow'] ?? ''), 0, 120),
                'title' => mb_substr((string) ($block['title'] ?? ''), 0, 255),
                'subtitle' => mb_substr((string) ($block['subtitle'] ?? ''), 0, 1000),
                'backgroundColor' => mb_substr((string) ($block['backgroundColor'] ?? '#fffdf8'), 0, 20),
                'accentColor' => mb_substr((string) ($block['accentColor'] ?? '#171411'), 0, 20),
                'textColor' => mb_substr((string) ($block['textColor'] ?? '#201a16'), 0, 20),
                'paddingTop' => max(0, min((int) ($block['paddingTop'] ?? 16), 120)),
                'paddingBottom' => max(0, min((int) ($block['paddingBottom'] ?? 18), 120)),
            ];
        }

        if ($type === 'footer') {
            return [
                'type' => 'footer',
                'companyName' => mb_substr((string) ($block['companyName'] ?? ''), 0, 120),
                'note' => mb_substr((string) ($block['note'] ?? ''), 0, 1000),
                'websiteUrl' => mb_substr((string) ($block['websiteUrl'] ?? ''), 0, 255),
                'instagramUrl' => mb_substr((string) ($block['instagramUrl'] ?? ''), 0, 255),
                'tiktokUrl' => mb_substr((string) ($block['tiktokUrl'] ?? ''), 0, 255),
                'emailAddress' => mb_substr((string) ($block['emailAddress'] ?? ''), 0, 255),
                'phoneNumber' => mb_substr((string) ($block['phoneNumber'] ?? ''), 0, 120),
                'addressLine' => mb_substr((string) ($block['addressLine'] ?? ''), 0, 255),
                'contactLine' => mb_substr((string) ($block['contactLine'] ?? ''), 0, 255),
                'backgroundColor' => mb_substr((string) ($block['backgroundColor'] ?? '#f3ede3'), 0, 20),
                'textColor' => mb_substr((string) ($block['textColor'] ?? '#5f564d'), 0, 20),
                'accentColor' => mb_substr((string) ($block['accentColor'] ?? '#171411'), 0, 20),
                'paddingTop' => max(0, min((int) ($block['paddingTop'] ?? 18), 120)),
                'paddingBottom' => max(0, min((int) ($block['paddingBottom'] ?? 20), 120)),
            ];
        }

        return null;
    }

    private function generateCampaignDraftResponse(array $validated, string $model, Request $request): array
    {
        try {
            return $this->groqService->createResponse(
                $this->campaignGenerationPrompt($validated),
                $model,
                [
                    'temperature' => 0.45,
                    'max_output_tokens' => 1800,
                ],
                $request->user(),
            );
        } catch (RequestException $exception) {
            if (($exception->response?->status() ?? null) !== 413) {
                $payload = $exception->response?->json();
                throw new RuntimeException($payload['error']['message'] ?? $exception->getMessage());
            }
        }

        try {
            return $this->groqService->createResponse(
                $this->compactCampaignGenerationPrompt($validated),
                $model,
                [
                    'temperature' => 0.35,
                    'max_output_tokens' => 900,
                ],
                $request->user(),
            );
        } catch (RequestException $exception) {
            $payload = $exception->response?->json();

            if (($exception->response?->status() ?? null) === 413) {
                throw new RuntimeException('Groq rejected the campaign request size even after automatic fallback. This usually means the selected model or endpoint is too restrictive. Switch to a larger Groq model or reduce the generated output size.');
            }

            throw new RuntimeException($payload['error']['message'] ?? $exception->getMessage());
        }
    }
}
