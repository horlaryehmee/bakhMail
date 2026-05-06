<?php

namespace App\Console\Commands;

use App\Models\AppSetting;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Hash;

class SetupApplication extends Command
{
    protected $signature = 'bakhmail:setup
        {--force : Run setup without interactive confirmation}
        {--seed-demo : Seed the demo users from DatabaseSeeder}
        {--skip-optimize : Skip Laravel cache warmup}';

    protected $description = 'Prepare BakhMail after environment variables and database details are configured.';

    public function handle(): int
    {
        $this->components->info('Preparing BakhMail for use...');

        $this->callSilent('optimize:clear');

        if (! filled(config('app.key'))) {
            $this->components->task('Generating application key', function (): void {
                $this->call('key:generate', ['--force' => true]);
            });
        } else {
            $this->components->info('Application key already configured.');
        }

        $this->components->task('Running database migrations', function (): void {
            $this->call('migrate', ['--force' => true]);
        });

        $this->ensureStorageLink();
        $this->seedSystemSettings();
        $this->ensureAdminUser();

        if ($this->option('seed-demo') || filter_var(env('SETUP_SEED_DEMO_DATA', false), FILTER_VALIDATE_BOOL)) {
            $this->components->task('Seeding demo data', function (): void {
                $this->call('db:seed', ['--class' => 'Database\\Seeders\\DatabaseSeeder', '--force' => true]);
            });
        }

        if (! $this->option('skip-optimize')) {
            $this->components->task('Caching framework artifacts', function (): void {
                $this->call('optimize');
            });
        }

        $this->warnIfAssetsAreMissing();
        $this->warnIfRedisIsExpected();

        $this->newLine();
        $this->components->info('BakhMail setup complete.');

        return self::SUCCESS;
    }

    private function ensureStorageLink(): void
    {
        $storageLink = public_path('storage');

        if (File::exists($storageLink)) {
            $this->components->info('Public storage link already exists.');

            return;
        }

        $this->components->task('Creating public storage link', function (): void {
            $this->call('storage:link');
        });
    }

    private function seedSystemSettings(): void
    {
        $defaults = [
            'tracking_base_url' => config('bulkmail.tracking_base_url'),
            'warmup_default_recipient' => config('bulkmail.warmup_default_recipient'),
            'suppression_retention_days' => config('bulkmail.suppression_retention_days'),
            'groq_response_model' => config('services.groq.default_response_model'),
        ];

        foreach ($defaults as $key => $value) {
            if (! filled($value)) {
                continue;
            }

            AppSetting::firstOrCreate(
                ['key' => $key],
                ['value' => $value],
            );
        }

        $this->components->info('System defaults synced into app settings.');
    }

    private function ensureAdminUser(): void
    {
        $email = trim((string) env('SETUP_ADMIN_EMAIL', ''));
        $password = (string) env('SETUP_ADMIN_PASSWORD', '');

        if ($email === '' || $password === '') {
            if (! User::query()->where('role', User::ROLE_ADMIN)->exists()) {
                $this->components->warn('No admin user was created because SETUP_ADMIN_EMAIL or SETUP_ADMIN_PASSWORD is missing.');
            }

            return;
        }

        $user = User::query()->updateOrCreate(
            ['email' => $email],
            [
                'name' => env('SETUP_ADMIN_NAME', 'Admin User'),
                'password' => Hash::make($password),
                'role' => User::ROLE_ADMIN,
                'timezone' => env('SETUP_ADMIN_TIMEZONE', config('app.timezone', 'UTC')),
                'avatar_color' => env('SETUP_ADMIN_AVATAR_COLOR', '#60a5fa'),
            ],
        );

        $this->components->info("Admin user ready: {$user->email}");
    }

    private function warnIfAssetsAreMissing(): void
    {
        if (! File::exists(public_path('build/manifest.json'))) {
            $this->components->warn('Frontend assets are not built yet. Run `npm install` and `npm run build` before going live.');
        }
    }

    private function warnIfRedisIsExpected(): void
    {
        if (config('queue.default') === 'redis' || config('cache.default') === 'redis') {
            $this->components->warn('Redis-backed queue or cache is enabled. Make sure Redis is reachable in production.');
        }
    }
}
