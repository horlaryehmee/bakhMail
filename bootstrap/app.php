<?php

use App\Http\Middleware\EnsureApplicationInstalled;
use App\Http\Middleware\AddSecurityHeaders;
use App\Http\Middleware\EnsureRole;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->append(AddSecurityHeaders::class);

        $middleware->alias([
            'installed' => EnsureApplicationInstalled::class,
            'role' => EnsureRole::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (Throwable $exception, Request $request) {
            if (! ($request->is('api/*') || $request->expectsJson())) {
                return null;
            }

            if ($exception instanceof HttpResponseException) {
                return $exception->getResponse();
            }

            if ($exception instanceof ValidationException) {
                return response()->json([
                    'message' => $exception->getMessage() ?: 'The given data was invalid.',
                    'errors' => $exception->errors(),
                ], $exception->status);
            }

            if ($exception instanceof AuthenticationException) {
                return response()->json([
                    'message' => 'Authentication required.',
                ], 401);
            }

            $status = $exception instanceof HttpExceptionInterface ? $exception->getStatusCode() : 500;
            $message = $status >= 500
                ? (app()->hasDebugModeEnabled() ? $exception->getMessage() : 'Server error. Check logs and try again.')
                : $exception->getMessage();

            return response()->json([
                'message' => $message ?: match ($status) {
                    404 => 'The requested mailbox item was not found. Refresh the replies page and try again.',
                    419 => 'Your session expired. Refresh the page and sign in again.',
                    default => 'The request could not be completed. Refresh the page and try again.',
                },
            ], $status);
        });
    })->create();
