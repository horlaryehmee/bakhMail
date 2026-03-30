<?php

namespace App\Support;

use Illuminate\Support\Facades\File;

class InstallationState
{
    public static function markerPath(): string
    {
        return storage_path('app/install.lock');
    }

    public static function isInstalled(): bool
    {
        if (filter_var(env('APP_INSTALLED', false), FILTER_VALIDATE_BOOL)) {
            return true;
        }

        return File::exists(static::markerPath());
    }

    public static function markInstalled(array $payload): void
    {
        File::ensureDirectoryExists(dirname(static::markerPath()));

        File::put(static::markerPath(), json_encode([
            'installed_at' => now()->toIso8601String(),
            ...$payload,
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
    }
}
