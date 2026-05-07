<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Validator;

class UploadController extends Controller
{
    private const BLOCKED_EXTENSIONS = [
        'php', 'php3', 'php4', 'php5', 'phtml', 'phar', 'cgi', 'pl', 'py', 'rb', 'sh', 'bash',
        'bat', 'cmd', 'com', 'exe', 'dll', 'msi', 'htaccess', 'js', 'mjs', 'html', 'htm',
    ];

    private const ALLOWED_MIME_PREFIXES = ['image/', 'audio/', 'video/', 'text/'];

    private const ALLOWED_MIME_TYPES = [
        'application/pdf',
        'application/msword',
        'application/vnd.ms-excel',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/zip',
        'application/x-zip-compressed',
    ];

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
            'files.*' => ['file', 'max:15360', function (string $attribute, UploadedFile $file, Closure $fail): void {
                $extension = strtolower($file->getClientOriginalExtension());
                $mimeType = strtolower((string) $file->getMimeType());

                if (in_array($extension, self::BLOCKED_EXTENSIONS, true)) {
                    $fail('This file type is not allowed.');
                    return;
                }

                $hasAllowedPrefix = collect(self::ALLOWED_MIME_PREFIXES)->contains(
                    fn (string $prefix): bool => str_starts_with($mimeType, $prefix)
                );

                if (! $hasAllowedPrefix && ! in_array($mimeType, self::ALLOWED_MIME_TYPES, true)) {
                    $fail('This MIME type is not allowed.');
                }
            }],
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
