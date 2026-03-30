<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CommentController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\RequestController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\TaskController;
use App\Http\Controllers\Api\UploadController;
use Illuminate\Support\Facades\Route;

Route::prefix('auth')->group(function (): void {
    Route::post('/login', [AuthController::class, 'login']);
    Route::post('/register-invite', [AuthController::class, 'registerInvite']);
    Route::get('/invites/{token}', [AuthController::class, 'showInvite']);

    Route::middleware('workspace.auth')->group(function (): void {
        Route::get('/me', [AuthController::class, 'me']);
        Route::patch('/me', [AuthController::class, 'updateProfile']);
        Route::patch('/password', [AuthController::class, 'updatePassword']);
        Route::get('/users', [AuthController::class, 'users']);
        Route::get('/pending-invites', [AuthController::class, 'pendingInvites'])->middleware('workspace.role:master_admin,admin');
        Route::post('/invite', [AuthController::class, 'createInvite'])->middleware('workspace.role:master_admin,admin');
        Route::patch('/users/{user}', [AuthController::class, 'updateUser'])->middleware('workspace.role:master_admin');
        Route::patch('/users/{user}/password', [AuthController::class, 'resetUserPassword'])->middleware('workspace.role:master_admin');
    });
});

Route::get('/settings/branding', [SettingsController::class, 'branding']);

Route::middleware('workspace.auth')->group(function (): void {
    Route::get('/dashboard/summary', [DashboardController::class, 'summary']);
    Route::get('/dashboard/export/projects.csv', [DashboardController::class, 'exportProjectsCsv']);

    Route::get('/projects', [ProjectController::class, 'index']);
    Route::get('/projects/{project}', [ProjectController::class, 'show']);
    Route::post('/projects', [ProjectController::class, 'store'])->middleware('workspace.role:master_admin,admin');
    Route::patch('/projects/{project}', [ProjectController::class, 'update'])->middleware('workspace.role:master_admin,admin');
    Route::delete('/projects/{project}', [ProjectController::class, 'destroy'])->middleware('workspace.role:master_admin,admin');

    Route::get('/tasks', [TaskController::class, 'index']);
    Route::post('/tasks', [TaskController::class, 'store'])->middleware('workspace.role:master_admin,admin');
    Route::patch('/tasks/{task}', [TaskController::class, 'update'])->middleware('workspace.role:master_admin,admin');
    Route::patch('/tasks/{task}/status', [TaskController::class, 'updateStatus'])->middleware('workspace.role:master_admin,admin');
    Route::delete('/tasks/{task}', [TaskController::class, 'destroy'])->middleware('workspace.role:master_admin,admin');

    Route::get('/comments', [CommentController::class, 'index']);
    Route::post('/comments', [CommentController::class, 'store']);
    Route::delete('/comments/{comment}', [CommentController::class, 'destroy'])->middleware('workspace.role:master_admin,admin');

    Route::get('/requests', [RequestController::class, 'index']);
    Route::post('/requests', [RequestController::class, 'store']);
    Route::patch('/requests/{request}', [RequestController::class, 'update'])->middleware('workspace.role:master_admin,admin');
    Route::delete('/requests/{request}', [RequestController::class, 'destroy'])->middleware('workspace.role:master_admin,admin');

    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::patch('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::patch('/notifications/{notification}/read', [NotificationController::class, 'markRead']);

    Route::patch('/settings/branding', [SettingsController::class, 'updateBranding'])->middleware('workspace.role:master_admin');
    Route::get('/settings/demo-data', [SettingsController::class, 'demoData'])->middleware('workspace.role:master_admin');
    Route::post('/settings/demo-data/populate', [SettingsController::class, 'populateDemoData'])->middleware('workspace.role:master_admin');
    Route::delete('/settings/demo-data', [SettingsController::class, 'clearDemoData'])->middleware('workspace.role:master_admin');

    Route::post('/uploads', [UploadController::class, 'store']);
});
