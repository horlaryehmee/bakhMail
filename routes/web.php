<?php

use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AnalyticsController;
use App\Http\Controllers\Api\CampaignController;
use App\Http\Controllers\Api\ContactController;
use App\Http\Controllers\Api\ConversationController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\EmailAccountController;
use App\Http\Controllers\Api\GroqController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\TwoFactorController;
use App\Http\Controllers\InstallController;
use App\Http\Controllers\PublicTrackingController;
use App\Http\Controllers\SpaController;
use Illuminate\Support\Facades\Route;

Route::get('/install', [InstallController::class, 'show'])->name('install.show');
Route::post('/install', [InstallController::class, 'install'])->name('install.run');

Route::middleware('installed')->group(function (): void {
Route::prefix('auth')->group(function (): void {
    Route::post('/register', [AuthController::class, 'register'])->name('auth.register');
    Route::post('/login', [AuthController::class, 'login'])->name('auth.login');
    Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth')->name('auth.logout');
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword'])->name('auth.forgot-password');
    Route::post('/reset-password', [AuthController::class, 'resetPassword'])->name('auth.reset-password');
    Route::post('/2fa/challenge', [TwoFactorController::class, 'challenge'])->name('auth.2fa.challenge');
});

Route::get('/track/open/{token}.gif', [PublicTrackingController::class, 'open'])->name('track.open');
Route::get('/track/click/{token}', [PublicTrackingController::class, 'click'])->name('track.click');
Route::get('/unsubscribe/{token}', [PublicTrackingController::class, 'unsubscribe'])->name('track.unsubscribe');

Route::prefix('api')->group(function (): void {
    Route::get('/me', [AuthController::class, 'me'])->name('api.me');

    Route::middleware('auth')->group(function (): void {
        Route::get('/dashboard', [DashboardController::class, 'show'])->name('api.dashboard');
        Route::put('/profile', [SettingsController::class, 'profile'])->name('api.profile.update');

        Route::get('/contacts/export', [ContactController::class, 'export'])->name('api.contacts.export');
        Route::get('/contacts/import-template', [ContactController::class, 'importTemplate'])->name('api.contacts.import-template');
        Route::post('/contacts/import', [ContactController::class, 'import'])->name('api.contacts.import');
        Route::post('/contacts/clear', [ContactController::class, 'clear'])->name('api.contacts.clear');
        Route::post('/contacts/quick-send', [ContactController::class, 'quickSend'])->name('api.contacts.quick-send');
        Route::post('/contacts/{contact}/save', [ContactController::class, 'save'])->name('api.contacts.save');
        Route::post('/contacts/{contact}/remove', [ContactController::class, 'remove'])->name('api.contacts.remove');
        Route::apiResource('contacts', ContactController::class);

        Route::get('/email-accounts/deliverability', [EmailAccountController::class, 'deliverability'])->name('api.email-accounts.deliverability');
        Route::post('/email-accounts/{emailAccount}/test', [EmailAccountController::class, 'test'])->name('api.email-accounts.test');
        Route::post('/email-accounts/connect', [EmailAccountController::class, 'connect'])->name('api.email-accounts.connect');
        Route::post('/email-accounts/{emailAccount}/save', [EmailAccountController::class, 'save'])->name('api.email-accounts.save');
        Route::post('/email-accounts/{emailAccount}/remove', [EmailAccountController::class, 'remove'])->name('api.email-accounts.remove');
        Route::post('/email-accounts/{emailAccount}/test-connection', [EmailAccountController::class, 'testConnection'])->name('api.email-accounts.test-connection');
        Route::post('/email-accounts/{emailAccount}/test-imap', [EmailAccountController::class, 'testImap'])->name('api.email-accounts.test-imap');
        Route::post('/email-accounts/{emailAccount}/sync-replies', [EmailAccountController::class, 'syncReplies'])->name('api.email-accounts.sync-replies');
        Route::apiResource('email-accounts', EmailAccountController::class);

        Route::post('/campaigns/generate', [CampaignController::class, 'generate'])->name('api.campaigns.generate');
        Route::post('/campaigns/assist-details', [CampaignController::class, 'assistDetails'])->name('api.campaigns.assist-details');
        Route::post('/campaigns/test-draft', [CampaignController::class, 'testDraft'])->name('api.campaigns.test-draft');
        Route::get('/campaigns/builder-template', [CampaignController::class, 'builderTemplate'])->name('api.campaigns.builder-template');
        Route::put('/campaigns/builder-template', [CampaignController::class, 'saveBuilderTemplate'])->name('api.campaigns.builder-template.save');
        Route::post('/campaigns/{campaign}/launch', [CampaignController::class, 'launch'])->name('api.campaigns.launch');
        Route::get('/campaigns/{campaign}/preview', [CampaignController::class, 'preview'])->name('api.campaigns.preview');
        Route::apiResource('campaigns', CampaignController::class);

        Route::get('/conversations', [ConversationController::class, 'index'])->name('api.conversations.index');
        Route::get('/conversations/{thread}', [ConversationController::class, 'show'])->name('api.conversations.show');

        Route::get('/analytics', [AnalyticsController::class, 'index'])->name('api.analytics.index');
        Route::get('/analytics/export/csv', [AnalyticsController::class, 'exportCsv'])->name('api.analytics.export.csv');

        Route::get('/notifications', [NotificationController::class, 'index'])->name('api.notifications.index');
        Route::post('/notifications/{notification}/read', [NotificationController::class, 'markRead'])->name('api.notifications.read');

        Route::get('/2fa/setup', [TwoFactorController::class, 'setup'])->name('api.2fa.setup');
        Route::post('/2fa/enable', [TwoFactorController::class, 'enable'])->name('api.2fa.enable');
        Route::post('/2fa/disable', [TwoFactorController::class, 'disable'])->name('api.2fa.disable');

        Route::middleware('role:admin')->prefix('admin')->group(function (): void {
            Route::get('/summary', [AdminController::class, 'summary'])->name('api.admin.summary');
            Route::get('/users', [AdminController::class, 'users'])->name('api.admin.users');
            Route::put('/users/{user}', [AdminController::class, 'updateUser'])->name('api.admin.users.update');
            Route::get('/settings', [AdminController::class, 'settings'])->name('api.admin.settings');
            Route::put('/settings', [AdminController::class, 'updateSettings'])->name('api.admin.settings.update');
            Route::post('/database/migrate', [AdminController::class, 'migrateDatabase'])->name('api.admin.database.migrate');
            Route::get('/groq/status', [GroqController::class, 'status'])->name('api.admin.groq.status');
            Route::get('/groq/models', [GroqController::class, 'models'])->name('api.admin.groq.models');
            Route::post('/groq/responses', [GroqController::class, 'responses'])->name('api.admin.groq.responses');
        });
    });
});

Route::get('/{any?}', SpaController::class)
    ->where('any', '^(?!api|auth|track|unsubscribe|up).*$')
    ->name('spa');
});
