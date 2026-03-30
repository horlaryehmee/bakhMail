<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\BrandingSetting;
use App\Support\WorkspaceDemoData;
use App\Support\WorkspacePresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    public function branding(): JsonResponse
    {
        $branding = BrandingSetting::query()->where('key', 'branding')->first();

        return response()->json([
            'branding' => WorkspacePresenter::branding($branding),
        ]);
    }

    public function updateBranding(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'brandName' => ['required', 'string', 'max:80'],
            'logoUrl' => ['nullable', 'string', 'max:2048'],
            'logoSize' => ['required', 'numeric', 'min:0.8', 'max:1.8'],
        ]);

        $branding = BrandingSetting::query()->updateOrCreate(
            ['key' => 'branding'],
            [
                'brand_name' => trim($payload['brandName']) ?: 'Bakhtech Solutions',
                'logo_url' => $payload['logoUrl'] ?? '',
                'logo_size' => $payload['logoSize'],
            ]
        );

        return response()->json([
            'branding' => WorkspacePresenter::branding($branding),
        ]);
    }

    public function demoData(): JsonResponse
    {
        return response()->json(['demoData' => WorkspaceDemoData::status()]);
    }

    public function populateDemoData(Request $request): JsonResponse
    {
        return response()->json(['demoData' => WorkspaceDemoData::populate($request->user())]);
    }

    public function clearDemoData(): JsonResponse
    {
        return response()->json(['demoData' => WorkspaceDemoData::clear()]);
    }
}
