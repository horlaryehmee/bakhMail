<?php

use App\Http\Controllers\InstallController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/install', [InstallController::class, 'show'])->name('install.show');
Route::post('/install', [InstallController::class, 'install'])->name('install.run');

Route::middleware('app.installed')->group(function (): void {
    Route::get('/', fn () => Inertia::render('Workspace'))->name('workspace');
    Route::get('/dashboard', fn () => Inertia::render('Workspace'))->name('dashboard');
});
