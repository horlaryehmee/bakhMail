<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', fn () => Inertia::render('Workspace'))->name('workspace');
Route::get('/dashboard', fn () => Inertia::render('Workspace'))->name('dashboard');
