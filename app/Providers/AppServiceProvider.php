<?php

namespace App\Providers;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\ServiceProvider;
use Throwable;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->runPendingMigrationsOnWebRequest();
    }

    private function runPendingMigrationsOnWebRequest(): void
    {
        static $checked = false;

        if ($checked || $this->app->runningInConsole()) {
            return;
        }

        $checked = true;

        try {
            if (! File::exists(storage_path('app/install.lock')) || ! Schema::hasTable('migrations')) {
                return;
            }

            $ranMigrations = DB::table('migrations')->pluck('migration')->all();
            $migrationFiles = collect(File::files(database_path('migrations')))
                ->map(fn ($file) => pathinfo($file->getFilename(), PATHINFO_FILENAME))
                ->all();

            $pending = array_diff($migrationFiles, $ranMigrations);

            if ($pending === []) {
                return;
            }

            Artisan::call('migrate', ['--force' => true]);
        } catch (Throwable $exception) {
            Log::warning('Automatic migration check failed.', [
                'message' => $exception->getMessage(),
            ]);
        }
    }
}
