<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EmailAccount;
use App\Services\ActivityLogger;
use App\Services\DeliverabilityService;
use App\Services\DynamicSmtpMailer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class EmailAccountController extends Controller
{
    public function __construct(
        private readonly DeliverabilityService $deliverabilityService,
        private readonly DynamicSmtpMailer $dynamicSmtpMailer,
        private readonly ActivityLogger $activityLogger,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $this->ensureSchemaReady();

        $accountsQuery = $request->user()->emailAccounts()->latest();

        if (Schema::hasTable('email_logs')) {
            $accountsQuery->withCount(['emailLogs as sent_count' => fn ($query) => $query->where('event_type', 'sent')]);
        }

        $accounts = $accountsQuery->get();

        return response()->json([
            'data' => $accounts->map(fn (EmailAccount $account) => $this->serializeAccount($account))->all(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->ensureSchemaReady();

        $validated = $this->validatePayload($request);
        $account = $request->user()->emailAccounts()->create($validated);

        $this->activityLogger->log($request->user(), 'accounts.created', $account, $request, description: "Added email account {$account->email_address}.");

        return response()->json(['data' => $this->serializeAccount($account)], 201);
    }

    public function show(Request $request, int $emailAccount): JsonResponse
    {
        $this->ensureSchemaReady();

        $emailAccount = EmailAccount::query()->findOrFail($emailAccount);
        abort_unless($emailAccount->user_id === $request->user()->id, 404);

        if (Schema::hasTable('email_logs')) {
            $emailAccount->loadCount(['emailLogs as sent_count' => fn ($query) => $query->where('event_type', 'sent')]);
        }

        return response()->json(['data' => $this->serializeAccount($emailAccount)]);
    }

    public function update(Request $request, int $emailAccount): JsonResponse
    {
        $this->ensureSchemaReady();

        $emailAccount = EmailAccount::query()->findOrFail($emailAccount);
        abort_unless($emailAccount->user_id === $request->user()->id, 404);
        $validated = $this->validatePayload($request, $emailAccount->id);

        foreach (['smtp_password', 'imap_password', 'oauth_access_token', 'oauth_refresh_token'] as $secretField) {
            if (($validated[$secretField] ?? null) === null || $validated[$secretField] === '') {
                unset($validated[$secretField]);
            }
        }

        $emailAccount->update($validated);

        $this->activityLogger->log($request->user(), 'accounts.updated', $emailAccount, $request, description: "Updated email account {$emailAccount->email_address}.");

        return response()->json(['data' => $this->serializeAccount($emailAccount)]);
    }

    public function destroy(Request $request, int $emailAccount): JsonResponse
    {
        $this->ensureSchemaReady();

        $emailAccount = EmailAccount::query()->findOrFail($emailAccount);
        abort_unless($emailAccount->user_id === $request->user()->id, 404);
        $address = $emailAccount->email_address;
        $emailAccount->delete();

        $this->activityLogger->log($request->user(), 'accounts.deleted', EmailAccount::class, $request, ['email' => $address], "Deleted email account {$address}.");

        return response()->json(['status' => 'deleted']);
    }

    public function deliverability(Request $request): JsonResponse
    {
        $this->ensureSchemaReady();

        $domains = $request->filled('domain')
            ? [$request->string('domain')->toString()]
            : $request->user()->emailAccounts()->get()->map(fn (EmailAccount $account) => substr(strrchr($account->email_address, '@'), 1))->filter()->unique()->values()->all();

        return response()->json([
            'data' => collect($domains)->map(fn ($domain) => $this->deliverabilityService->inspectDomain($domain))->all(),
        ]);
    }

    public function test(Request $request, int $emailAccount): JsonResponse
    {
        $this->ensureSchemaReady();

        $emailAccount = EmailAccount::query()->findOrFail($emailAccount);
        abort_unless($emailAccount->user_id === $request->user()->id, 404);

        $validated = $request->validate([
            'to_email' => ['nullable', 'email'],
        ]);

        $to = $validated['to_email'] ?? $request->user()->email;
        $subject = 'BakhMail account test';
        $html = '<p>Your SMTP connection is active and ready for campaign traffic.</p>';

        $result = $this->dynamicSmtpMailer->send($emailAccount, [
            'to' => $to,
            'subject' => $subject,
            'html' => $html,
            'text' => strip_tags($html),
        ]);

        $this->activityLogger->log($request->user(), 'accounts.tested', $emailAccount, $request, ['to' => $to], "Sent an SMTP test message to {$to}.");

        return response()->json([
            'status' => 'sent',
            'message_id' => $result['message_id'] ?? null,
        ]);
    }

    private function validatePayload(Request $request, ?int $ignoreId = null): array
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'from_name' => ['nullable', 'string', 'max:255'],
            'email_address' => ['required', 'email', Rule::unique('email_accounts', 'email_address')->ignore($ignoreId)->where(fn ($query) => $query->where('user_id', $request->user()->id))],
            'reply_to_address' => ['nullable', 'email'],
            'provider' => ['nullable', 'string', Rule::in(['custom', 'gmail', 'outlook', 'php_mail'])],
            'status' => ['nullable', 'string', 'max:50'],
            'smtp_host' => ['nullable', 'string', 'max:255'],
            'smtp_port' => ['nullable', 'integer'],
            'smtp_encryption' => ['nullable', 'string', 'max:10'],
            'smtp_username' => ['nullable', 'string', 'max:255'],
            'smtp_password' => ['nullable', 'string'],
            'imap_host' => ['nullable', 'string', 'max:255'],
            'imap_port' => ['nullable', 'integer'],
            'imap_encryption' => ['nullable', 'string', 'max:10'],
            'imap_username' => ['nullable', 'string', 'max:255'],
            'imap_password' => ['nullable', 'string'],
            'oauth_provider' => ['nullable', 'string', 'max:50'],
            'oauth_access_token' => ['nullable', 'string'],
            'oauth_refresh_token' => ['nullable', 'string'],
            'oauth_expires_at' => ['nullable', 'date'],
            'warmup_enabled' => ['sometimes', 'boolean'],
            'warmup_target_email' => ['nullable', 'email'],
            'daily_limit' => ['nullable', 'integer', 'min:1'],
            'hourly_limit' => ['nullable', 'integer', 'min:1'],
            'health_score' => ['nullable', 'integer', 'min:0', 'max:100'],
            'metadata' => ['nullable', 'array'],
        ]);

        if (($validated['provider'] ?? 'custom') !== 'php_mail') {
            if (blank($validated['smtp_host'] ?? null) || blank($validated['smtp_port'] ?? null)) {
                throw ValidationException::withMessages([
                    'smtp_host' => 'SMTP host and port are required unless the provider is PHP Mail.',
                ]);
            }
        }

        return $validated;
    }

    private function serializeAccount(EmailAccount $account): array
    {
        return [
            'id' => $account->id,
            'name' => $account->name,
            'from_name' => $account->from_name,
            'email_address' => $account->email_address,
            'reply_to_address' => $account->reply_to_address,
            'provider' => $account->provider,
            'status' => $account->status,
            'smtp_host' => $account->smtp_host,
            'smtp_port' => $account->smtp_port,
            'smtp_encryption' => $account->smtp_encryption,
            'smtp_username' => $account->smtp_username,
            'imap_host' => $account->imap_host,
            'imap_port' => $account->imap_port,
            'imap_encryption' => $account->imap_encryption,
            'imap_username' => $account->imap_username,
            'oauth_provider' => $account->oauth_provider,
            'oauth_expires_at' => $account->oauth_expires_at?->toIso8601String(),
            'warmup_enabled' => $account->warmup_enabled,
            'warmup_target_email' => $account->warmup_target_email,
            'daily_limit' => $account->daily_limit,
            'hourly_limit' => $account->hourly_limit,
            'health_score' => $account->health_score,
            'last_synced_at' => $account->last_synced_at?->toIso8601String(),
            'metadata' => $account->metadata ?? [],
            'sent_count' => $account->sent_count ?? 0,
            'smtp_configured' => $account->provider === 'php_mail' || (bool) ($account->smtp_host && $account->smtp_port),
            'imap_configured' => $account->hasImapConfiguration(),
        ];
    }

    private function ensureSchemaReady(): void
    {
        if (! Schema::hasTable('email_accounts')) {
            $this->createEmailAccountsTable();
        }

        $requiredColumns = [
            'id',
            'user_id',
            'name',
            'email_address',
            'provider',
            'status',
            'smtp_host',
            'smtp_port',
            'smtp_username',
            'smtp_password',
            'imap_host',
            'imap_port',
            'imap_username',
            'imap_password',
            'warmup_enabled',
            'daily_limit',
            'hourly_limit',
            'health_score',
            'metadata',
            'created_at',
            'updated_at',
        ];

        if (! Schema::hasColumns('email_accounts', $requiredColumns)) {
            throw new HttpResponseException(response()->json([
                'message' => 'The mailbox schema is incomplete on this server. Run `php artisan migrate --force` to repair it.',
            ], 503));
        }
    }

    private function createEmailAccountsTable(): void
    {
        Schema::create('email_accounts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('from_name')->nullable();
            $table->string('email_address');
            $table->string('reply_to_address')->nullable();
            $table->string('provider')->default('custom');
            $table->string('status')->default('active')->index();
            $table->string('smtp_host')->nullable();
            $table->unsignedSmallInteger('smtp_port')->nullable();
            $table->string('smtp_encryption')->nullable();
            $table->string('smtp_username')->nullable();
            $table->text('smtp_password')->nullable();
            $table->string('imap_host')->nullable();
            $table->unsignedSmallInteger('imap_port')->nullable();
            $table->string('imap_encryption')->nullable();
            $table->string('imap_username')->nullable();
            $table->text('imap_password')->nullable();
            $table->string('oauth_provider')->nullable();
            $table->text('oauth_access_token')->nullable();
            $table->text('oauth_refresh_token')->nullable();
            $table->timestamp('oauth_expires_at')->nullable();
            $table->boolean('warmup_enabled')->default(false);
            $table->string('warmup_target_email')->nullable();
            $table->unsignedSmallInteger('daily_limit')->default(150);
            $table->unsignedSmallInteger('hourly_limit')->default(25);
            $table->unsignedTinyInteger('health_score')->default(100);
            $table->timestamp('last_synced_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'email_address']);
        });
    }
}
