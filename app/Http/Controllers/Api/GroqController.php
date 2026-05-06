<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Services\GroqService;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;

class GroqController extends Controller
{
    public function __construct(private readonly GroqService $groqService)
    {
    }

    public function status(): JsonResponse
    {
        $responseOverride = $this->setting('groq_response_model');
        $resolvedResponseModel = $responseOverride ?: config('services.groq.default_response_model');
        $verified = false;
        $message = null;
        $providerLimits = null;

        if (filled(config('services.groq.api_key')) || filled($this->setting('groq_api_key'))) {
            try {
                $providerLimits = $this->groqService->verifyConnection();
                $resolvedResponseModel = $this->groqService->resolveResponseModel($responseOverride ?: null);
                $verified = true;
            } catch (\Throwable) {
                $message = 'Saved Groq key could not be verified against the Groq API.';
            }
        }

        $usageSnapshot = $this->groqService->usageSnapshot($resolvedResponseModel);

        return response()->json([
            'configured' => filled(config('services.groq.api_key')) || filled($this->setting('groq_api_key')),
            'verified' => $verified,
            'message' => $message,
            'base_url' => config('services.groq.base_url'),
            'default_response_model' => config('services.groq.default_response_model'),
            'response_model_override' => $responseOverride,
            'resolved_response_model' => $resolvedResponseModel,
            'provider_limits' => $providerLimits,
            'usage_today' => $usageSnapshot['today'],
            'daily_limits' => $usageSnapshot['daily_limits'],
        ]);
    }

    public function models(): JsonResponse
    {
        return response()->json($this->forward(fn () => [
            'data' => $this->groqService->listModels(),
        ]));
    }

    public function responses(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'model' => ['nullable', 'string', 'max:255'],
            'input' => ['required'],
            'temperature' => ['nullable', 'numeric'],
            'max_output_tokens' => ['nullable', 'integer', 'min:1'],
        ]);

        $model = $this->groqService->resolveResponseModel($validated['model'] ?: $this->setting('groq_response_model'));

        return response()->json($this->forward(function () use ($validated, $model, $request) {
            $result = $this->groqService->createResponse(
            $validated['input'],
            $model,
            [
                'temperature' => $validated['temperature'] ?? null,
                'max_output_tokens' => $validated['max_output_tokens'] ?? null,
            ],
            $request->user(),
        );

            $usageSnapshot = $this->groqService->usageSnapshot($model);

            return [
                ...$result,
                'usage_today' => $usageSnapshot['today'],
                'daily_limits' => $usageSnapshot['daily_limits'],
            ];
        }));
    }

    private function setting(string $key): mixed
    {
        return AppSetting::query()->where('key', $key)->first()?->value;
    }

    private function forward(callable $callback): array
    {
        try {
            return $callback();
        } catch (RuntimeException $exception) {
            abort(response()->json(['message' => $exception->getMessage()], 422));
        } catch (RequestException $exception) {
            $payload = $exception->response?->json();

            abort(response()->json([
                'message' => $payload['error']['message'] ?? $exception->getMessage(),
                'error' => $payload['error'] ?? null,
            ], $exception->response?->status() ?: 502));
        }
    }
}
