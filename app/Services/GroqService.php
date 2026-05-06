<?php

namespace App\Services;

use App\Models\AppSetting;
use App\Models\GroqUsageLog;
use App\Models\User;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class GroqService
{
    private const FREE_PLAN_LIMITS = [
        'llama-3.1-8b-instant' => ['requests_per_day' => 14400, 'tokens_per_day' => 500000],
        'llama-3.3-70b-versatile' => ['requests_per_day' => 1000, 'tokens_per_day' => 100000],
        'meta-llama/llama-4-scout-17b-16e-instruct' => ['requests_per_day' => 1000, 'tokens_per_day' => 500000],
        'openai/gpt-oss-20b' => ['requests_per_day' => 1000, 'tokens_per_day' => 200000],
        'openai/gpt-oss-120b' => ['requests_per_day' => 1000, 'tokens_per_day' => 200000],
        'groq/compound-mini' => ['requests_per_day' => 250, 'tokens_per_day' => null],
        'groq/compound' => ['requests_per_day' => 250, 'tokens_per_day' => null],
    ];

    public function verifyConnection(): array
    {
        return $this->extractProviderLimits($this->request()
            ->get('/openai/v1/models')
            ->throw()
        );
    }

    public function listModels(): array
    {
        $response = $this->request()
            ->get('/openai/v1/models')
            ->throw()
            ->json();

        return collect($response['data'] ?? [])
            ->filter(fn ($model) => filled($model['id'] ?? null))
            ->map(fn ($model) => [
                'id' => (string) $model['id'],
                'object' => $model['object'] ?? null,
                'owned_by' => $model['owned_by'] ?? null,
                'context_window' => $model['context_window'] ?? null,
                'active' => $model['active'] ?? null,
            ])
            ->sortBy('id')
            ->values()
            ->all();
    }

    public function createResponse(string|array $input, string $model, array $options = [], ?User $user = null): array
    {
        $payload = array_filter([
            'model' => $model,
            'input' => $input,
            ...$options,
        ], fn ($value) => $value !== null);

        $response = $this->request()
            ->withHeaders([
                'Groq-Beta' => 'inference-metrics',
            ])
            ->post('/openai/v1/responses', array_filter([
                'model' => $model,
                'input' => $input,
                ...$options,
            ], fn ($value) => $value !== null));

        $response->throw();

        $body = $response->json();
        $usage = $this->normalizeUsage($body['usage'] ?? []);
        $providerLimits = $this->extractProviderLimits($response);
        $metadata = is_array($body['metadata'] ?? null) ? $body['metadata'] : [];

        $this->recordUsage($user, $body, $payload, $usage, $metadata);

        return [
            'id' => $body['id'] ?? null,
            'status' => $body['status'] ?? null,
            'model' => $body['model'] ?? $model,
            'created_at' => $body['created_at'] ?? null,
            'output_text' => $this->extractOutputText($body),
            'usage' => $usage,
            'metrics' => $metadata,
            'provider_limits' => $providerLimits,
        ];
    }

    public function resolveResponseModel(?string $requestedModel = null): string
    {
        return $requestedModel ?: (string) config('services.groq.default_response_model');
    }

    public function usageSnapshot(string $model): array
    {
        $today = Carbon::today();
        $usageToday = GroqUsageLog::query()
            ->where('created_at', '>=', $today)
            ->selectRaw('COUNT(*) as request_count')
            ->selectRaw('COALESCE(SUM(input_tokens), 0) as input_tokens')
            ->selectRaw('COALESCE(SUM(output_tokens), 0) as output_tokens')
            ->selectRaw('COALESCE(SUM(total_tokens), 0) as total_tokens')
            ->first();

        $configuredRequestLimit = $this->normalizeIntegerSetting(AppSetting::query()->where('key', 'groq_daily_request_limit')->first()?->value);
        $configuredTokenLimit = $this->normalizeIntegerSetting(AppSetting::query()->where('key', 'groq_daily_token_limit')->first()?->value);
        $defaultLimits = self::FREE_PLAN_LIMITS[$model] ?? ['requests_per_day' => null, 'tokens_per_day' => null];

        $requestsPerDay = $configuredRequestLimit ?? $defaultLimits['requests_per_day'];
        $tokensPerDay = $configuredTokenLimit ?? $defaultLimits['tokens_per_day'];

        return [
            'today' => [
                'request_count' => (int) ($usageToday?->request_count ?? 0),
                'input_tokens' => (int) ($usageToday?->input_tokens ?? 0),
                'output_tokens' => (int) ($usageToday?->output_tokens ?? 0),
                'total_tokens' => (int) ($usageToday?->total_tokens ?? 0),
            ],
            'daily_limits' => [
                'requests_per_day' => $requestsPerDay,
                'tokens_per_day' => $tokensPerDay,
                'requests_remaining_today' => $requestsPerDay !== null ? max($requestsPerDay - (int) ($usageToday?->request_count ?? 0), 0) : null,
                'tokens_remaining_today' => $tokensPerDay !== null ? max($tokensPerDay - (int) ($usageToday?->total_tokens ?? 0), 0) : null,
                'source' => $configuredRequestLimit !== null || $configuredTokenLimit !== null ? 'admin_override' : (isset(self::FREE_PLAN_LIMITS[$model]) ? 'groq_free_plan_default' : 'unknown'),
            ],
        ];
    }

    private function request(): PendingRequest
    {
        $apiKey = $this->resolveApiKey();

        if (! $apiKey) {
            throw new RuntimeException('Groq is not configured. Add a Groq API key in Admin settings or set GROQ_API_KEY.');
        }

        return Http::baseUrl(rtrim((string) config('services.groq.base_url'), '/'))
            ->acceptJson()
            ->asJson()
            ->timeout(30)
            ->withToken($apiKey);
    }

    private function resolveApiKey(): ?string
    {
        $storedValue = AppSetting::query()->where('key', 'groq_api_key')->first()?->value;

        if (filled($storedValue)) {
            try {
                return $this->normalizeApiKey(Crypt::decryptString((string) $storedValue));
            } catch (\Throwable) {
                // Fall back to env configuration if the stored value cannot be decrypted.
            }
        }

        return $this->normalizeApiKey(config('services.groq.api_key'));
    }

    private function normalizeApiKey(?string $apiKey): ?string
    {
        if (! filled($apiKey)) {
            return null;
        }

        $apiKey = trim((string) $apiKey);

        if (str_starts_with($apiKey, 'Bearer ')) {
            $apiKey = trim(substr($apiKey, 7));
        }

        return $apiKey !== '' ? $apiKey : null;
    }

    private function extractOutputText(array $payload): string
    {
        $outputText = Arr::get($payload, 'output_text');

        if (is_string($outputText) && $outputText !== '') {
            return $outputText;
        }

        return collect($payload['output'] ?? [])
            ->filter(fn ($item) => ($item['type'] ?? null) === 'message')
            ->flatMap(fn ($item) => $item['content'] ?? [])
            ->filter(fn ($content) => ($content['type'] ?? null) === 'output_text' && filled($content['text'] ?? null))
            ->pluck('text')
            ->implode("\n\n");
    }

    private function normalizeUsage(array $usage): array
    {
        return [
            'input_tokens' => (int) ($usage['input_tokens'] ?? 0),
            'output_tokens' => (int) ($usage['output_tokens'] ?? 0),
            'total_tokens' => (int) ($usage['total_tokens'] ?? 0),
            'cached_tokens' => (int) Arr::get($usage, 'input_tokens_details.cached_tokens', 0),
            'reasoning_tokens' => (int) Arr::get($usage, 'output_tokens_details.reasoning_tokens', 0),
        ];
    }

    private function extractProviderLimits(Response $response): array
    {
        return [
            'requests_per_day' => $this->integerHeader($response, 'x-ratelimit-limit-requests'),
            'requests_remaining' => $this->integerHeader($response, 'x-ratelimit-remaining-requests'),
            'requests_reset_in' => $response->header('x-ratelimit-reset-requests'),
            'tokens_per_minute' => $this->integerHeader($response, 'x-ratelimit-limit-tokens'),
            'tokens_remaining_minute' => $this->integerHeader($response, 'x-ratelimit-remaining-tokens'),
            'tokens_reset_in' => $response->header('x-ratelimit-reset-tokens'),
            'retry_after' => $response->header('retry-after'),
        ];
    }

    private function integerHeader(Response $response, string $header): ?int
    {
        $value = $response->header($header);

        return is_numeric($value) ? (int) $value : null;
    }

    private function recordUsage(?User $user, array $responseBody, array $requestPayload, array $usage, array $metadata): void
    {
        GroqUsageLog::query()->create([
            'user_id' => $user?->id,
            'response_id' => $responseBody['id'] ?? null,
            'model' => $responseBody['model'] ?? ($requestPayload['model'] ?? 'unknown'),
            'input_tokens' => $usage['input_tokens'],
            'output_tokens' => $usage['output_tokens'],
            'total_tokens' => $usage['total_tokens'],
            'request_payload' => [
                'model' => $requestPayload['model'] ?? null,
                'input_preview' => $this->inputPreview($requestPayload['input'] ?? null),
            ],
            'response_metadata' => $metadata,
        ]);
    }

    private function inputPreview(string|array|null $input): ?string
    {
        if (is_string($input)) {
            return mb_substr($input, 0, 1000);
        }

        if (is_array($input)) {
            $flattened = Collection::make($input)
                ->map(function ($item) {
                    if (is_string($item)) {
                        return $item;
                    }

                    if (is_array($item)) {
                        return json_encode($item);
                    }

                    return null;
                })
                ->filter()
                ->implode("\n");

            return $flattened !== '' ? mb_substr($flattened, 0, 1000) : null;
        }

        return null;
    }

    private function normalizeIntegerSetting(mixed $value): ?int
    {
        if (! is_numeric($value)) {
            return null;
        }

        $normalized = (int) $value;

        return $normalized > 0 ? $normalized : null;
    }
}
