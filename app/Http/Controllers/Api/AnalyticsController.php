<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AnalyticsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AnalyticsController extends Controller
{
    public function __construct(private readonly AnalyticsService $analyticsService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        return response()->json($this->analyticsService->summaryForUser($request->user()));
    }

    public function exportCsv(Request $request): StreamedResponse
    {
        $rows = $this->analyticsService->exportRows($request->user());

        return response()->streamDownload(function () use ($rows): void {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['type', 'campaign', 'status', 'sent', 'replies', 'bounces', 'reply_rate']);

            foreach ($rows as $row) {
                fputcsv($handle, $row);
            }

            fclose($handle);
        }, 'analytics.csv', ['Content-Type' => 'text/csv']);
    }
}
