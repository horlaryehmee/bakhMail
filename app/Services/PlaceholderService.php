<?php

namespace App\Services;

use App\Models\Campaign;
use App\Models\Contact;
use App\Models\EmailAccount;

class PlaceholderService
{
    public function render(string $content, Contact $contact, Campaign $campaign, EmailAccount $account): string
    {
        $replacements = array_merge([
            '{{first_name}}' => $contact->first_name ?: 'there',
            '{{last_name}}' => $contact->last_name ?: '',
            '{{full_name}}' => $contact->full_name,
            '{{email}}' => $contact->email,
            '{{company}}' => $contact->company ?: 'your company',
            '{{job_title}}' => $contact->job_title ?: '',
            '{{location}}' => $contact->location ?: '',
            '{{campaign_name}}' => $campaign->name,
            '{{sender_name}}' => $account->from_name ?: $account->name,
            '{{sender_email}}' => $account->email_address,
        ], collect($contact->custom_fields ?? [])
            ->mapWithKeys(fn ($value, $key) => ['{{'.$key.'}}' => (string) $value])
            ->all());

        return str_replace(array_keys($replacements), array_values($replacements), $content);
    }
}
