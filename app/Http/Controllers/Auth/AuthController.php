<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(private readonly ActivityLogger $activityLogger)
    {
    }

    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'confirmed', 'min:8'],
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => strtolower($validated['email']),
            'password' => $validated['password'],
            'role' => User::ROLE_STANDARD,
            'avatar_color' => collect(['#60a5fa', '#34d399', '#fb7185', '#f59e0b'])->random(),
        ]);

        Auth::login($user);
        $request->session()->regenerate();

        $this->activityLogger->log($user, 'auth.registered', $user, $request, description: 'New user registration completed.');

        return response()->json([
            'user' => $this->serializeUser($user),
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'remember' => ['sometimes', 'boolean'],
        ]);

        $user = User::query()->where('email', strtolower($validated['email']))->first();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            throw ValidationException::withMessages(['email' => 'The provided credentials are invalid.']);
        }

        if ($user->two_factor_secret && $user->two_factor_confirmed_at) {
            $request->session()->put('auth.pending_2fa_user_id', $user->id);
            $request->session()->put('auth.pending_2fa_remember', (bool) ($validated['remember'] ?? false));

            return response()->json([
                'requires_two_factor' => true,
            ]);
        }

        Auth::login($user, (bool) ($validated['remember'] ?? false));
        $request->session()->regenerate();
        $user->update(['last_seen_at' => now()]);

        $this->activityLogger->log($user, 'auth.logged_in', $user, $request, description: 'User signed in.');

        return response()->json([
            'user' => $this->serializeUser($user),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();

        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        $this->activityLogger->log($user, 'auth.logged_out', $user, $request, description: 'User signed out.');

        return response()->json(['status' => 'ok']);
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
        ]);

        $status = Password::sendResetLink([
            'email' => strtolower($validated['email']),
        ]);

        return response()->json([
            'status' => $status,
        ]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'confirmed', 'min:8'],
        ]);

        $status = Password::reset(
            $validated,
            function (User $user, string $password): void {
                $user->forceFill([
                    'password' => $password,
                    'remember_token' => Str::random(60),
                ])->save();

                event(new PasswordReset($user));
            },
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages(['email' => __($status)]);
        }

        return response()->json(['status' => $status]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'user' => $request->user() ? $this->serializeUser($request->user()) : null,
        ]);
    }

    private function serializeUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'timezone' => $user->timezone,
            'avatar_color' => $user->avatar_color,
            'two_factor_enabled' => (bool) ($user->two_factor_secret && $user->two_factor_confirmed_at),
        ];
    }
}
