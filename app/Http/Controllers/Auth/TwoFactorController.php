<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\TwoFactorService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class TwoFactorController extends Controller
{
    public function __construct(private readonly TwoFactorService $twoFactorService)
    {
    }

    public function setup(Request $request): JsonResponse
    {
        $user = $request->user();
        $secret = $request->session()->get('auth.2fa_setup_secret', $this->twoFactorService->generateSecret());
        $request->session()->put('auth.2fa_setup_secret', $secret);

        return response()->json([
            'secret' => $secret,
            'otpauth_uri' => $this->twoFactorService->provisioningUri($user, $secret),
        ]);
    }

    public function enable(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string'],
        ]);

        $user = $request->user();
        $secret = $request->session()->get('auth.2fa_setup_secret');

        if (! $secret || ! $this->twoFactorService->verify($secret, $validated['code'])) {
            throw ValidationException::withMessages(['code' => 'The verification code is invalid.']);
        }

        $recoveryCodes = $this->twoFactorService->generateRecoveryCodes();

        $user->update([
            'two_factor_secret' => encrypt($secret),
            'two_factor_recovery_codes' => array_map(fn ($code) => encrypt($code), $recoveryCodes),
            'two_factor_confirmed_at' => now(),
        ]);

        $request->session()->forget('auth.2fa_setup_secret');

        return response()->json([
            'recovery_codes' => $recoveryCodes,
        ]);
    }

    public function disable(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'current_password' => ['required', 'string', 'current_password'],
        ]);

        $user = $request->user();

        $user->update([
            'two_factor_secret' => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
        ]);

        return response()->json(['status' => 'disabled']);
    }

    public function challenge(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required_without:recovery_code', 'nullable', 'string'],
            'recovery_code' => ['required_without:code', 'nullable', 'string'],
        ]);

        $pendingUserId = $request->session()->get('auth.pending_2fa_user_id');
        $remember = (bool) $request->session()->get('auth.pending_2fa_remember', false);
        $user = User::query()->find($pendingUserId);

        if (! $user || ! $user->two_factor_secret) {
            throw ValidationException::withMessages(['code' => 'The two-factor challenge has expired.']);
        }

        $secret = decrypt($user->two_factor_secret);
        $verified = false;

        if (! empty($validated['code'])) {
            $verified = $this->twoFactorService->verify($secret, $validated['code']);
        } elseif (! empty($validated['recovery_code'])) {
            $codes = collect($user->two_factor_recovery_codes ?? [])->map(fn ($code) => decrypt($code));
            $verified = $codes->contains($validated['recovery_code']);

            if ($verified) {
                $remaining = $codes->reject(fn ($code) => $code === $validated['recovery_code'])
                    ->map(fn ($code) => encrypt($code))
                    ->values()
                    ->all();

                $user->update(['two_factor_recovery_codes' => $remaining]);
            }
        }

        if (! $verified) {
            throw ValidationException::withMessages(['code' => 'The two-factor code was not accepted.']);
        }

        Auth::login($user, $remember);
        $request->session()->forget(['auth.pending_2fa_user_id', 'auth.pending_2fa_remember']);
        $request->session()->regenerate();
        $user->update(['last_seen_at' => now()]);

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
                'timezone' => $user->timezone,
                'avatar_color' => $user->avatar_color,
                'two_factor_enabled' => true,
            ],
        ]);
    }
}
