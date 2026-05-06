<?php

namespace App\Http\Controllers;

use App\Support\InstallationService;
use App\Support\InstallationState;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;
use Throwable;

class InstallController extends Controller
{
    public function show(Request $request): View|RedirectResponse
    {
        if (InstallationState::isInstalled()) {
            return redirect()->to('/');
        }

        return view('install', [
            'defaults' => [
                'app_name' => config('app.name', 'BakhMail'),
                'app_url' => $request->root(),
                'db_host' => old('db_host', 'localhost'),
                'db_port' => old('db_port', '3306'),
                'db_name' => old('db_name', ''),
                'db_user' => old('db_user', ''),
                'mail_scheme' => old('mail_scheme', 'smtp'),
                'mail_host' => old('mail_host', ''),
                'mail_port' => old('mail_port', '587'),
                'mail_user' => old('mail_user', ''),
                'mail_from_address' => old('mail_from_address', ''),
                'mail_from_name' => old('mail_from_name', config('app.name', 'BakhMail')),
                'admin_name' => old('admin_name', ''),
                'admin_email' => old('admin_email', ''),
            ],
            'requirements' => InstallationService::requirements(),
        ]);
    }

    public function install(Request $request, InstallationService $installer): View|RedirectResponse
    {
        if (InstallationState::isInstalled()) {
            return redirect()->to('/');
        }

        $payload = $request->validate([
            'app_name' => ['required', 'string', 'min:2', 'max:80'],
            'db_host' => ['required', 'string', 'max:255'],
            'db_port' => ['required', 'integer', 'between:1,65535'],
            'db_name' => ['required', 'string', 'max:255'],
            'db_user' => ['required', 'string', 'max:255'],
            'db_password' => ['nullable', 'string', 'max:255'],
            'mail_scheme' => ['nullable', 'string', 'max:20'],
            'mail_host' => ['nullable', 'string', 'max:255'],
            'mail_port' => ['nullable', 'integer', 'between:1,65535'],
            'mail_user' => ['nullable', 'string', 'max:255'],
            'mail_password' => ['nullable', 'string', 'max:255'],
            'mail_from_address' => ['nullable', 'email', 'max:190'],
            'mail_from_name' => ['nullable', 'string', 'max:80'],
            'admin_name' => ['required', 'string', 'min:2', 'max:120'],
            'admin_email' => ['required', 'email', 'max:190'],
            'admin_password' => ['required', 'string', 'min:10', 'max:128', 'confirmed', 'regex:/[a-z]/', 'regex:/[A-Z]/', 'regex:/[0-9]/', 'regex:/[^A-Za-z0-9]/'],
        ], [
            'admin_password.regex' => 'The admin password must include uppercase, lowercase, number, and symbol characters.',
        ]);

        try {
            $result = $installer->install([
                ...$payload,
                'app_url' => $request->root(),
            ]);
        } catch (ValidationException $exception) {
            throw $exception;
        } catch (Throwable $exception) {
            report($exception);

            throw ValidationException::withMessages([
                'install' => 'Installation failed. Check file permissions, database credentials, and server requirements, then try again.',
            ]);
        }

        return view('install', [
            'completed' => true,
            'login' => $result['login'],
            'appUrl' => $request->root(),
        ]);
    }
}
