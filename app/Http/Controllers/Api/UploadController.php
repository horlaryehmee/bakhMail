<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Validator;

class UploadController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $files = $request->file('files', []);

        if ($files instanceof UploadedFile) {
            $files = [$files];
        }

        Validator::make([
            'files' => $files,
        ], [
            'files' => ['required', 'array', 'max:10'],
            'files.*' => ['file', 'max:15360'],
        ])->validate();

        $directory = public_path('uploads');

        if (! File::exists($directory)) {
            File::makeDirectory($directory, 0775, true);
        }

        $attachments = collect($files)
            ->map(function ($file) use ($directory, $request) {
                $originalName = $file->getClientOriginalName();
                $mimeType = $file->getMimeType();
                $size = $file->getSize();
                $filename = Str::uuid()->toString() . '.' . $file->getClientOriginalExtension();
                $file->move($directory, $filename);

                return [
                    'name' => $originalName,
                    'url' => '/uploads/' . $filename,
                    'size' => $size,
                    'mimeType' => $mimeType,
                    'uploadedBy' => (string) $request->user()->getKey(),
                    'uploadedAt' => now()->toIso8601String(),
                ];
            })
            ->values()
            ->all();

        return response()->json(['attachments' => $attachments], 201);
    }
}
