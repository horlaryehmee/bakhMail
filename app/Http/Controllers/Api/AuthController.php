<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Invite;
use App\Models\User;
use App\Support\WorkspaceAccess;
use App\Support\WorkspaceAuth;
use App\Support\WorkspacePresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string', 'min:8', 'max:128'],
        ]);

        $user = User::query()->where('email', strtolower($credentials['email']))->first();

        if (! $user || ! $user->is_active || ! Hash::check($credentials['password'], $user->password)) {
            return response()->json(['message' => 'Invalid email or password'], 401);
        }

        return response()->json([
            'token' => WorkspaceAuth::issueToken($user),
            'user' => WorkspacePresenter::user($user),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'user' => WorkspacePresenter::user($request->user()),
        ]);
    }

    public function users(Request $request): JsonResponse
    {
        /** @var User $authUser */
        $authUser = $request->user();

        if (in_array($authUser->role, ['master_admin', 'admin'], true)) {
            return response()->json([
                'users' => User::query()
                    ->orderBy('name')
                    ->get()
                    ->map(fn (User $user) => WorkspacePresenter::user($user))
                    ->all(),
            ]);
        }

        $projectIds = WorkspaceAccess::projectIdsFor($authUser);
        $users = User::query()
            ->where(function ($query) use ($projectIds, $authUser): void {
                $query->whereKey($authUser->getKey())
                    ->orWhereHas('createdProjects', fn ($builder) => $builder->whereIn('projects.id', $projectIds))
                    ->orWhereHas('teamProjects', fn ($builder) => $builder->whereIn('projects.id', $projectIds))
                    ->orWhereHas('clientProjects', fn ($builder) => $builder->whereIn('projects.id', $projectIds));
            })
            ->orderBy('name')
            ->get();

        return response()->json([
            'users' => $users->map(fn (User $user) => WorkspacePresenter::user($user, false))->all(),
        ]);
    }

    public function pendingInvites(Request $request): JsonResponse
    {
        /** @var User $authUser */
        $authUser = $request->user();

        $invites = Invite::query()
            ->whereNull('accepted_at')
            ->where('expires_at', '>', now())
            ->when($authUser->role === 'admin', fn ($query) => $query->where('role', 'client'))
            ->latest()
            ->get();

        return response()->json([
            'invites' => $invites->map(fn (Invite $invite) => WorkspacePresenter::invite($invite, config('app.url')))->all(),
        ]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $payload = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'email' => ['required', 'email', Rule::unique('users', 'email')->ignore($user->getKey())],
            'title' => ['nullable', 'string', 'max:80'],
            'notificationPreferences' => ['required', 'array'],
            'notificationPreferences.comments' => ['required', 'boolean'],
            'notificationPreferences.requests' => ['required', 'boolean'],
            'notificationPreferences.deadlines' => ['required', 'boolean'],
            'notificationPreferences.activity' => ['required', 'boolean'],
        ]);

        $user->update([
            'name' => $payload['name'],
            'email' => strtolower($payload['email']),
            'title' => $payload['title'] ?? '',
            'notification_preferences' => $payload['notificationPreferences'],
        ]);

        return response()->json([
            'token' => WorkspaceAuth::issueToken($user->fresh()),
            'user' => WorkspacePresenter::user($user->fresh()),
        ]);
    }

    public function updateUser(Request $request, User $user): JsonResponse
    {
        $payload = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'email' => ['required', 'email', Rule::unique('users', 'email')->ignore($user->getKey())],
            'title' => ['nullable', 'string', 'max:80'],
            'role' => ['required', Rule::in(['master_admin', 'admin', 'client'])],
            'isActive' => ['required', 'boolean'],
        ]);

        if ($user->role === 'master_admin' && ($payload['role'] !== 'master_admin' || ! $payload['isActive'])) {
            $remaining = User::query()
                ->where('role', 'master_admin')
                ->where('is_active', true)
                ->whereKeyNot($user->getKey())
                ->count();

            if ($remaining === 0) {
                throw ValidationException::withMessages([
                    'role' => 'At least one active Master Admin must remain in the system.',
                ]);
            }
        }

        $user->update([
            'name' => $payload['name'],
            'email' => strtolower($payload['email']),
            'title' => $payload['title'] ?? '',
            'role' => $payload['role'],
            'is_active' => $payload['isActive'],
        ]);

        return response()->json([
            'user' => WorkspacePresenter::user($user->fresh()),
        ]);
    }

    public function updatePassword(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $payload = $request->validate([
            'currentPassword' => ['required', 'string', 'min:8', 'max:128'],
            'newPassword' => ['required', 'string', 'min:10', 'max:128', 'regex:/[a-z]/', 'regex:/[A-Z]/', 'regex:/[0-9]/', 'regex:/[^A-Za-z0-9]/'],
        ]);

        if (! Hash::check($payload['currentPassword'], $user->password)) {
            return response()->json(['message' => 'Current password is incorrect'], 401);
        }

        $user->update([
            'password' => Hash::make($payload['newPassword']),
        ]);

        return response()->json([
            'token' => WorkspaceAuth::issueToken($user->fresh()),
            'user' => WorkspacePresenter::user($user->fresh()),
        ]);
    }

    public function resetUserPassword(Request $request, User $user): JsonResponse
    {
        $payload = $request->validate([
            'newPassword' => ['required', 'string', 'min:10', 'max:128', 'regex:/[a-z]/', 'regex:/[A-Z]/', 'regex:/[0-9]/', 'regex:/[^A-Za-z0-9]/'],
        ]);

        $user->update([
            'password' => Hash::make($payload['newPassword']),
        ]);

        $currentUser = $request->user();
        $response = ['user' => WorkspacePresenter::user($user->fresh())];

        if ($currentUser && (string) $currentUser->getKey() === (string) $user->getKey()) {
            $response['token'] = WorkspaceAuth::issueToken($user->fresh());
        }

        return response()->json($response);
    }

    public function showInvite(string $token): JsonResponse
    {
        $invite = Invite::query()->where('token', $token)->first();

        if (! $invite) {
            return response()->json(['message' => 'Invite not found or expired'], 404);
        }

        $status = $invite->accepted_at
            ? 'accepted'
            : ($invite->expires_at->isFuture() ? 'pending' : 'expired');

        return response()->json([
            'invite' => [
                'email' => $invite->email,
                'role' => $invite->role,
                'status' => $status,
            ],
        ]);
    }

    public function createInvite(Request $request): JsonResponse
    {
        /** @var User $authUser */
        $authUser = $request->user();

        $payload = $request->validate([
            'email' => ['required', 'email'],
            'role' => ['required', Rule::in(['master_admin', 'admin', 'client'])],
        ]);

        if ($authUser->role === 'admin' && $payload['role'] !== 'client') {
            return response()->json(['message' => 'Admins can only invite clients'], 403);
        }

        $email = strtolower($payload['email']);

        if (User::query()->where('email', $email)->exists()) {
            return response()->json(['message' => 'A user already exists with that email'], 409);
        }

        Invite::query()
            ->where('email', $email)
            ->whereNull('accepted_at')
            ->where('expires_at', '>', now())
            ->update(['expires_at' => now()]);

        $invite = Invite::query()->create([
            'email' => $email,
            'role' => $payload['role'],
            'token' => Str::random(48),
            'invited_by_id' => $authUser->getKey(),
            'expires_at' => now()->addWeek(),
        ]);

        return response()->json([
            'invite' => WorkspacePresenter::invite($invite, config('app.url')),
        ], 201);
    }

    public function registerInvite(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'token' => ['required', 'string', 'min:10'],
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'password' => ['required', 'string', 'min:10', 'max:128', 'regex:/[a-z]/', 'regex:/[A-Z]/', 'regex:/[0-9]/', 'regex:/[^A-Za-z0-9]/'],
            'title' => ['nullable', 'string', 'max:80'],
        ]);
        $validator->validate();

        $invite = Invite::query()
            ->where('token', $request->string('token')->toString())
            ->whereNull('accepted_at')
            ->where('expires_at', '>', now())
            ->first();

        if (! $invite) {
            return response()->json(['message' => 'Invite not found or expired'], 404);
        }

        if (User::query()->where('email', $invite->email)->exists()) {
            return response()->json(['message' => 'User already exists for this invite'], 409);
        }

        $user = User::query()->create([
            'name' => $request->string('name')->toString(),
            'email' => $invite->email,
            'password' => Hash::make($request->string('password')->toString()),
            'role' => $invite->role,
            'title' => $request->string('title')->toString(),
            'notification_preferences' => WorkspacePresenter::defaultNotificationPreferences(),
            'is_active' => true,
        ]);

        $invite->update(['accepted_at' => now()]);

        return response()->json([
            'token' => WorkspaceAuth::issueToken($user),
            'user' => WorkspacePresenter::user($user),
        ], 201);
    }
}
