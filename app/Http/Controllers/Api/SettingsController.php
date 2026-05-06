<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BrandingSetting;
use App\Support\WorkspaceDemoData;
use App\Support\WorkspacePresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class SettingsController extends Controller
{
    public function profile(Request $request): JsonResponse
    {
        $user = $request->user();

        $payload = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'current_password' => ['required', 'string'],
            'new_password' => ['nullable', 'string', 'min:10', 'max:128', 'confirmed', 'regex:/[a-z]/', 'regex:/[A-Z]/', 'regex:/[0-9]/', 'regex:/[^A-Za-z0-9]/'],
        ], [
            'new_password.regex' => 'The new password must include uppercase, lowercase, number, and symbol characters.',
        ]);

        if (! Hash::check($payload['current_password'], (string) $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => 'The current password is incorrect.',
            ]);
        }

        $updates = [
            'name' => trim($payload['name']),
            'email' => strtolower(trim($payload['email'])),
        ];

        if (filled($payload['new_password'] ?? null)) {
            $updates['password'] = $payload['new_password'];
        }

        $user->update($updates);

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'timezone' => $user->timezone,
                'avatar_color' => $user->avatar_color,
                'two_factor_enabled' => (bool) ($user->two_factor_secret && $user->two_factor_confirmed_at),
            ],
        ]);
    }

    public function branding(): JsonResponse
    {
        $branding = BrandingSetting::query()->where('key', 'branding')->first();

        return response()->json([
            'branding' => WorkspacePresenter::branding($branding),
        ]);
    }

    public function updateBranding(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'brandName' => ['required', 'string', 'max:80'],
            'logoUrl' => ['nullable', 'string', 'max:2048'],
            'logoSize' => ['required', 'numeric', 'min:0.8', 'max:1.8'],
        ]);

        $branding = BrandingSetting::query()->updateOrCreate(
            ['key' => 'branding'],
            [
                'brand_name' => trim($payload['brandName']) ?: 'Bakhtech Solutions',
                'logo_url' => trim((string) ($payload['logoUrl'] ?? '')),
                'logo_size' => $payload['logoSize'],
            ]
        );

        return response()->json([
            'branding' => WorkspacePresenter::branding($branding),
        ]);
    }

    public function demoData(): JsonResponse
    {
        return response()->json(['demoData' => WorkspaceDemoData::status()]);
    }

    public function populateDemoData(Request $request): JsonResponse
    {
        return response()->json(['demoData' => WorkspaceDemoData::populate($request->user())]);
    }

    public function clearDemoData(): JsonResponse
    {
        return response()->json(['demoData' => WorkspaceDemoData::clear()]);
    }
}
