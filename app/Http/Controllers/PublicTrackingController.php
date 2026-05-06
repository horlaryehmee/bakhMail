<?php

namespace App\Http\Controllers;

use App\Models\Contact;
use App\Models\EmailLog;
use App\Models\SuppressionEntry;
use App\Models\TrackingEvent;
use App\Services\AnalyticsService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class PublicTrackingController extends Controller
{
    public function __construct(private readonly AnalyticsService $analyticsService)
    {
    }

    public function open(string $token, Request $request): Response
    {
        $log = EmailLog::query()->where('tracking_token', $token)->first();

        if ($log) {
            $log->update(['opened_at' => $log->opened_at ?: now()]);
            TrackingEvent::create([
                'email_log_id' => $log->id,
                'campaign_id' => $log->campaign_id,
                'contact_id' => $log->contact_id,
                'token' => $token,
                'event_type' => 'open',
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);

            if ($log->campaign) {
                $this->analyticsService->refreshCampaign($log->campaign);
            }
        }

        return response(base64_decode('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='))
            ->header('Content-Type', 'image/gif');
    }

    public function click(string $token, Request $request): RedirectResponse
    {
        $log = EmailLog::query()->where('tracking_token', $token)->firstOrFail();
        $destination = base64_decode((string) $request->query('url'), true) ?: config('app.url');

        $log->update(['clicked_at' => $log->clicked_at ?: now()]);
        TrackingEvent::create([
            'email_log_id' => $log->id,
            'campaign_id' => $log->campaign_id,
            'contact_id' => $log->contact_id,
            'token' => $token,
            'event_type' => 'click',
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        if ($log->campaign) {
            $this->analyticsService->refreshCampaign($log->campaign);
        }

        return redirect()->away($destination);
    }

    public function unsubscribe(string $token): Response
    {
        $contact = Contact::query()->where('unsubscribe_token', $token)->first();
        $log = EmailLog::query()->where('unsubscribe_token', $token)->first();

        if ($contact) {
            $contact->update([
                'status' => 'unsubscribed',
                'unsubscribed_at' => now(),
            ]);

            SuppressionEntry::updateOrCreate(
                ['user_id' => $contact->user_id, 'email' => $contact->email],
                ['reason' => 'unsubscribe', 'source' => 'link'],
            );
        }

        if ($log) {
            EmailLog::create([
                'user_id' => $log->user_id,
                'campaign_id' => $log->campaign_id,
                'campaign_recipient_id' => $log->campaign_recipient_id,
                'contact_id' => $log->contact_id,
                'email_account_id' => $log->email_account_id,
                'direction' => 'system',
                'event_type' => 'unsubscribed',
                'recipient_email' => $log->recipient_email,
                'sender_email' => $log->sender_email,
                'subject' => $log->subject,
                'body_preview' => 'Recipient unsubscribed via tracking link.',
                'sent_at' => now(),
            ]);

            if ($log->campaign) {
                $this->analyticsService->refreshCampaign($log->campaign);
            }
        }

        return response(
            <<<'HTML'
            <html lang="en">
                <head><meta charset="utf-8"><title>Unsubscribed</title></head>
                <body style="font-family:system-ui,sans-serif;background:#f8fafc;color:#0f172a;padding:32px;">
                    <h1 style="margin-bottom:12px;">You have been unsubscribed.</h1>
                    <p>You will no longer receive outreach from this workspace.</p>
                </body>
            </html>
            HTML
        );
    }
}
