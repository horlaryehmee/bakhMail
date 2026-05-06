<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppSetting;
use App\Models\Campaign;
use App\Models\Contact;
use App\Models\EmailLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminController extends Controller
{
    public function summary(): JsonResponse
    {
        return response()->json([
            'users' => User::count(),
            'campaigns' => Campaign::count(),
            'contacts' => Contact::count(),
            'emails_sent' => EmailLog::query()->where('event_type', 'sent')->count(),
        ]);
    }

    public function users(): JsonResponse
    {
        return response()->json([
            'data' => User::query()
                ->withCount(['contacts', 'campaigns', 'emailAccounts'])
                ->latest()
                ->get()
                ->map(fn (User $user) => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role,
                    'timezone' => $user->timezone,
                    'contacts_count' => $user->contacts_count,
                    'campaigns_count' => $user->campaigns_count,
                    'email_accounts_count' => $user->email_accounts_count,
                    'last_seen_at' => $user->last_seen_at?->toIso8601String(),
                    'created_at' => $user->created_at?->toIso8601String(),
                ])->all(),
        ]);
    }

    public function updateUser(Request $request, User $user): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'role' => ['sometimes', Rule::in([User::ROLE_ADMIN, User::ROLE_STANDARD])],
            'timezone' => ['sometimes', 'string', 'max:120'],
        ]);

        $user->update($validated);

        return response()->json([
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'timezone' => $user->timezone,
            ],
        ]);
    }

    public function settings(): JsonResponse
    {
        return response()->json([
            'data' => AppSetting::query()->get()->mapWithKeys(fn (AppSetting $setting) => [$setting->key => $setting->value])->all(),
        ]);
    }

    public function updateSettings(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'settings' => ['required', 'array'],
        ]);

        foreach ($validated['settings'] as $key => $value) {
            AppSetting::updateOrCreate(
                ['key' => $key],
                ['value' => $value, 'updated_by' => $request->user()->id],
            );
        }

        return response()->json(['status' => 'saved']);
    }
}
