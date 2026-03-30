<?php

namespace App\Http\Middleware;

use App\Support\InstallationState;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureApplicationInstalled
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (InstallationState::isInstalled()) {
            return $next($request);
        }

        if ($request->is('api/*') || $request->expectsJson()) {
            return new JsonResponse([
                'message' => 'Application is not installed yet. Open /install to complete setup.',
            ], 503);
        }

        return new RedirectResponse(route('install.show'));
    }
}
