<?php

namespace App\Http\Middleware;

use App\Support\WorkspaceAuth;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ResolveWorkspaceUser
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();
        $user = WorkspaceAuth::findUserByToken($token);

        if (! $user) {
            return response()->json(['message' => 'Authentication required'], 401);
        }

        $request->setUserResolver(fn () => $user);

        return $next($request);
    }
}
