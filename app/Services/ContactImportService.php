<?php

namespace App\Services;

use App\Models\Contact;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use SplFileObject;

class ContactImportService
{
    public function import(User $user, UploadedFile $file): array
    {
        $csv = new SplFileObject($file->getRealPath());
        $csv->setFlags(SplFileObject::READ_CSV | SplFileObject::SKIP_EMPTY);

        $headers = [];
        $created = 0;
        $updated = 0;

        foreach ($csv as $index => $row) {
            if (! is_array($row) || $row === [null] || $row === false) {
                continue;
            }

            if ($index === 0) {
                $headers = collect($row)->map(fn ($header) => strtolower(trim((string) $header)))->all();
                continue;
            }

            $payload = array_combine($headers, array_pad($row, count($headers), null));
            $email = strtolower(trim((string) ($payload['email'] ?? '')));

            if ($email === '') {
                continue;
            }

            $contact = Contact::firstOrNew([
                'user_id' => $user->id,
                'email' => $email,
            ]);

            $contact->fill([
                'first_name' => $payload['first_name'] ?? null,
                'last_name' => $payload['last_name'] ?? null,
                'company' => $payload['company'] ?? null,
                'job_title' => $payload['job_title'] ?? ($payload['title'] ?? null),
                'phone' => $payload['phone'] ?? null,
                'website' => $payload['website'] ?? null,
                'location' => $payload['location'] ?? null,
                'notes' => $payload['notes'] ?? null,
                'custom_fields' => collect($payload)
                    ->except(['first_name', 'last_name', 'email', 'company', 'job_title', 'title', 'phone', 'website', 'location', 'notes'])
                    ->filter(fn ($value) => filled($value))
                    ->all(),
            ]);

            $contact->exists ? $updated++ : $created++;
            $contact->save();
        }

        return [
            'created' => $created,
            'updated' => $updated,
        ];
    }
}
