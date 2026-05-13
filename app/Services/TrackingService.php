<?php

namespace App\Services;

use App\Models\EmailLog;

class TrackingService
{
    public function decorate(EmailLog $log, string $html, array $options = []): string
    {
        $html = trim($html);
        $includeFooter = (bool) ($options['include_footer'] ?? true);

        $html = preg_replace_callback(
            '/href=["\']([^"\']+)["\']/i',
            function (array $matches) use ($log): string {
                $url = $matches[1];

                if (! str_starts_with($url, 'http')) {
                    return $matches[0];
                }

                $tracked = route('track.click', [
                    'token' => $log->tracking_token,
                    'url' => base64_encode($url),
                ]);

                return 'href="'.$tracked.'"';
            },
            $html,
        ) ?? $html;

        $pixel = '<img src="'.route('track.open', ['token' => $log->tracking_token]).'" alt="" width="1" height="1" style="display:block;opacity:0;" />';
        $footer = '';

        if ($includeFooter) {
            $unsubscribeUrl = route('track.unsubscribe', ['token' => $log->unsubscribe_token]);
            $footer = <<<HTML
                <div style="margin-top:24px;padding-top:16px;border-top:1px solid rgba(148,163,184,0.25);font-size:12px;color:#64748b;">
                    You are receiving this email because your address exists in an outreach list managed inside {$this->appName()}.
                    <a href="{$unsubscribeUrl}" style="color:#0f766e;">Unsubscribe instantly</a>
                </div>
            HTML;
        }

        if (str_contains(strtolower($html), '</body>')) {
            return preg_replace('/<\/body>/i', $footer.$pixel.'</body>', $html, 1) ?? ($html.$footer.$pixel);
        }

        return $html.$footer.$pixel;
    }

    private function appName(): string
    {
        return e(config('app.name'));
    }
}
