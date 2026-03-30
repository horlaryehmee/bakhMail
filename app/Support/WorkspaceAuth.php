<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Str;

class WorkspaceAuth
{
    public static function issueToken(User $user): string
    {
        $plain = Str::random(64);
        $user->forceFill([
            'api_token' => hash('sha256', $plain),
        ])->save();

        return $plain;
    }

    public static function findUserByToken(?string $token): ?User
    {
        if (! $token) {
            return null;
        }

        return User::query()
            ->where('api_token', hash('sha256', $token))
            ->where('is_active', true)
            ->first();
    }

    public static function clearToken(User $user): void
    {
        $user->forceFill(['api_token' => null])->save();
    }
}
