<?php

namespace App\Support;

use App\Models\BrandingSetting;
use App\Models\User;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use PDO;
use Throwable;

class InstallationService
{
    public static function requirements(): array
    {
        return [
            ['label' => 'PHP 8.3 or newer', 'passed' => version_compare(PHP_VERSION, '8.3.0', '>=')],
            ['label' => 'PDO MySQL extension', 'passed' => extension_loaded('pdo_mysql')],
            ['label' => 'Environment file writable', 'passed' => EnvironmentFile::writable()],
            ['label' => 'Storage writable', 'passed' => is_writable(storage_path())],
            ['label' => 'Bootstrap cache writable', 'passed' => is_writable(base_path('bootstrap/cache'))],
        ];
    }

    public function install(array $payload): array
    {
        $this->assertRequirements();
        $this->assertDatabaseConnection($payload);

        $appKey = 'base64:'.base64_encode(random_bytes(32));
        $mailScheme = $this->normalizeMailScheme(
            $payload['mail_scheme'] ?? null,
            $payload['mail_port'] ?? null,
            $payload['mail_host'] ?? null,
        );

        $envValues = [
            'APP_NAME' => $payload['app_name'],
            'APP_ENV' => 'production',
            'APP_DEBUG' => false,
            'APP_URL' => $payload['app_url'],
            'APP_KEY' => $appKey,
            'APP_INSTALLED' => false,
            'DB_CONNECTION' => 'mysql',
            'DB_HOST' => $payload['db_host'],
            'DB_PORT' => (string) $payload['db_port'],
            'DB_DATABASE' => $payload['db_name'],
            'DB_USERNAME' => $payload['db_user'],
            'DB_PASSWORD' => $payload['db_password'] ?? '',
            'SESSION_DRIVER' => 'file',
            'CACHE_STORE' => 'file',
            'QUEUE_CONNECTION' => 'sync',
            'MAIL_MAILER' => filled($payload['mail_host'] ?? null) ? 'smtp' : 'log',
            'MAIL_SCHEME' => $mailScheme,
            'MAIL_HOST' => $payload['mail_host'] ?: null,
            'MAIL_PORT' => filled($payload['mail_port'] ?? null) ? (string) $payload['mail_port'] : null,
            'MAIL_USERNAME' => $payload['mail_user'] ?: null,
            'MAIL_PASSWORD' => $payload['mail_password'] ?: null,
            'MAIL_FROM_ADDRESS' => $payload['mail_from_address'] ?: strtolower($payload['admin_email']),
            'MAIL_FROM_NAME' => $payload['mail_from_name'] ?: $payload['app_name'],
            'VITE_API_URL' => '/api',
        ];

        EnvironmentFile::write($envValues);
        $this->applyRuntimeConfiguration($envValues);

        Artisan::call('optimize:clear');
        DB::purge('mysql');
        DB::reconnect('mysql');

        try {
            Artisan::call('migrate', ['--force' => true]);
            $this->createInitialRecords($payload);
        } catch (Throwable $exception) {
            Artisan::call('optimize:clear');

            throw $exception;
        }

        InstallationState::markInstalled([
            'app_name' => $payload['app_name'],
            'admin_email' => strtolower($payload['admin_email']),
        ]);
        EnvironmentFile::write([
            'APP_INSTALLED' => true,
        ]);

        return [
            'login' => [
                'email' => strtolower($payload['admin_email']),
                'password' => $payload['admin_password'],
            ],
        ];
    }

    private function assertRequirements(): void
    {
        $failed = collect(static::requirements())->firstWhere('passed', false);

        if (! $failed) {
            return;
        }

        throw ValidationException::withMessages([
            'install' => $failed['label'].' requirement is not satisfied on this server.',
        ]);
    }

    private function assertDatabaseConnection(array $payload): void
    {
        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
            $payload['db_host'],
            $payload['db_port'],
            $payload['db_name'],
        );

        try {
            new PDO($dsn, $payload['db_user'], $payload['db_password'] ?? '', [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_TIMEOUT => 5,
            ]);
        } catch (Throwable) {
            throw ValidationException::withMessages([
                'db_host' => 'Database connection failed. Confirm the host, port, database name, username, and password.',
            ]);
        }
    }

    private function applyRuntimeConfiguration(array $envValues): void
    {
        foreach ($envValues as $key => $value) {
            $stringValue = is_bool($value) ? ($value ? 'true' : 'false') : (string) $value;

            putenv("{$key}={$stringValue}");
            $_ENV[$key] = $stringValue;
            $_SERVER[$key] = $stringValue;
        }

        Config::set('app.name', $envValues['APP_NAME']);
        Config::set('app.url', $envValues['APP_URL']);
        Config::set('app.key', $envValues['APP_KEY']);
        Config::set('database.default', 'mysql');
        Config::set('database.connections.mysql.host', $envValues['DB_HOST']);
        Config::set('database.connections.mysql.port', $envValues['DB_PORT']);
        Config::set('database.connections.mysql.database', $envValues['DB_DATABASE']);
        Config::set('database.connections.mysql.username', $envValues['DB_USERNAME']);
        Config::set('database.connections.mysql.password', $envValues['DB_PASSWORD']);
        Config::set('mail.default', $envValues['MAIL_MAILER']);
        Config::set('mail.mailers.smtp.scheme', $envValues['MAIL_SCHEME']);
        Config::set('mail.mailers.smtp.host', $envValues['MAIL_HOST']);
        Config::set('mail.mailers.smtp.port', $envValues['MAIL_PORT']);
        Config::set('mail.mailers.smtp.username', $envValues['MAIL_USERNAME']);
        Config::set('mail.mailers.smtp.password', $envValues['MAIL_PASSWORD']);
        Config::set('mail.from.address', $envValues['MAIL_FROM_ADDRESS']);
        Config::set('mail.from.name', $envValues['MAIL_FROM_NAME']);
    }

    private function normalizeMailScheme(mixed $scheme, mixed $port, mixed $host): ?string
    {
        if (! filled($host)) {
            return null;
        }

        $normalized = strtolower(trim((string) $scheme));
        $normalizedPort = (string) $port;

        return match ($normalized) {
            '', 'auto' => $normalizedPort === '465' ? 'smtps' : 'smtp',
            'tls' => 'smtp',
            'ssl' => 'smtps',
            'smtp', 'smtps' => $normalized,
            default => $normalized,
        };
    }

    private function createInitialRecords(array $payload): void
    {
        if (! Schema::hasTable('users') || ! Schema::hasTable('branding_settings')) {
            throw ValidationException::withMessages([
                'install' => 'Database tables were not created successfully during installation.',
            ]);
        }

        User::query()->updateOrCreate([
            'email' => strtolower($payload['admin_email']),
        ], [
            'name' => $payload['admin_name'],
            'password' => $payload['admin_password'],
            'role' => User::ROLE_ADMIN,
            'title' => 'Admin',
            'notification_preferences' => WorkspacePresenter::defaultNotificationPreferences(),
            'is_active' => true,
            'demo_data' => false,
            'api_token' => Str::random(80),
        ]);

        $admin = User::query()->where('email', strtolower($payload['admin_email']))->first();

        if (! $admin || ! Hash::check($payload['admin_password'], (string) $admin->password)) {
            throw ValidationException::withMessages([
                'install' => 'The first Master Admin account could not be verified after installation. Please run the installer again.',
            ]);
        }

        BrandingSetting::query()->updateOrCreate([
            'key' => 'branding',
        ], [
            'brand_name' => trim($payload['app_name']) ?: 'BakhMail',
            'logo_url' => '',
            'logo_size' => 1,
        ]);
    }
}
