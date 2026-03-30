<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;

class UploadController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'files' => ['required', 'array', 'max:10'],
            'files.*' => ['file', 'max:15360'],
        ]);

        $directory = public_path('uploads');

        if (! File::exists($directory)) {
            File::makeDirectory($directory, 0775, true);
        }

        $attachments = collect($request->file('files', []))
            ->map(function ($file) use ($directory, $request) {
                $filename = Str::uuid()->toString() . '.' . $file->getClientOriginalExtension();
                $file->move($directory, $filename);

                return [
                    'name' => $file->getClientOriginalName(),
                    'url' => '/uploads/' . $filename,
                    'size' => $file->getSize(),
                    'mimeType' => $file->getMimeType(),
                    'uploadedBy' => (string) $request->user()->getKey(),
                    'uploadedAt' => now()->toIso8601String(),
                ];
            })
            ->values()
            ->all();

        return response()->json(['attachments' => $attachments], 201);
    }
}
