@php
    $brandName = $branding['brandName'] ?? config('app.name', 'TaskManager');
    $logoUrl = $branding['logoUrl'] ?? '';
    $appUrl = $branding['appUrl'] ?? config('app.url');
    $eyebrow = $messageData['eyebrow'] ?? 'Workspace update';
    $headline = $messageData['headline'] ?? ($messageData['subject'] ?? $brandName);
    $intro = $messageData['intro'] ?? '';
    $body = $messageData['body'] ?? '';
    $actionUrl = $messageData['actionUrl'] ?? $appUrl;
    $actionLabel = $messageData['actionLabel'] ?? 'Open workspace';
    $details = $messageData['details'] ?? [];
    $highlights = $messageData['highlights'] ?? [];
    $footer = $messageData['footer'] ?? 'You can manage your workspace from the dashboard at any time.';
    $recipientName = $messageData['recipientName'] ?? null;
    $subject = $messageData['subject'] ?? $brandName;
    $preheader = trim(($intro ?: $body ?: $footer));
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $subject }}</title>
</head>
<body style="margin:0;padding:0;background:#f3efe8;color:#1f2937;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
        {{ $preheader }}
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3efe8;padding:28px 14px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:720px;">
                    <tr>
                        <td style="padding-bottom:18px;text-align:center;">
                            <div style="display:inline-block;border-radius:999px;border:1px solid #d9ceb8;background:rgba(255,255,255,0.76);padding:8px 16px;font-size:11px;line-height:1.4;letter-spacing:0.32em;text-transform:uppercase;color:#766b5a;">
                                {{ $eyebrow }}
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0;border-radius:34px;background:#fffdf9;border:1px solid #e2d7c8;box-shadow:0 26px 70px rgba(38,32,23,0.10);overflow:hidden;">
                                <tr>
                                    <td style="padding:0;">
                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(180deg,#fffaf2 0%,#f8f2e7 100%);">
                                            <tr>
                                                <td style="padding:30px 32px 22px;">
                                                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                                        <tr>
                                                            <td style="vertical-align:middle;">
                                                                <table role="presentation" cellspacing="0" cellpadding="0">
                                                                    <tr>
                                                                        <td style="vertical-align:middle;">
                                                                            @if ($logoUrl)
                                                                                <img src="{{ $logoUrl }}" alt="{{ $brandName }} logo" style="display:block;max-width:58px;max-height:58px;border-radius:18px;border:1px solid #e1d5c3;background:#ffffff;">
                                                                            @else
                                                                                <div style="width:58px;height:58px;border-radius:18px;border:1px solid #ddd0bc;background:#ffffff;font-size:22px;font-weight:700;line-height:58px;text-align:center;color:#191511;">
                                                                                    {{ strtoupper(substr($brandName, 0, 1)) }}
                                                                                </div>
                                                                            @endif
                                                                        </td>
                                                                        <td style="padding-left:14px;vertical-align:middle;">
                                                                            <div style="font-size:11px;line-height:1.4;letter-spacing:0.22em;text-transform:uppercase;color:#8a7d6b;">
                                                                                Concierge workspace
                                                                            </div>
                                                                            <div style="margin-top:6px;font-size:20px;line-height:1.2;font-weight:700;color:#17120c;">
                                                                                {{ $brandName }}
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                </table>
                                                            </td>
                                                            <td align="right" style="vertical-align:middle;">
                                                                <div style="display:inline-block;border-radius:999px;background:#17120c;color:#f7efe2;padding:9px 14px;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;">
                                                                    Private update
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding:0 32px 34px;">
                                                    @if ($recipientName)
                                                        <div style="margin:0 0 14px;font-size:13px;line-height:1.6;color:#766b5a;">
                                                            Hello {{ $recipientName }},
                                                        </div>
                                                    @endif

                                                    <div style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:40px;line-height:1.04;font-weight:700;color:#17120c;letter-spacing:-0.02em;">
                                                        {{ $headline }}
                                                    </div>

                                                    @if ($intro)
                                                        <div style="margin-top:18px;font-size:16px;line-height:1.8;color:#4d4336;">
                                                            {{ $intro }}
                                                        </div>
                                                    @endif

                                                    @if ($body)
                                                        <div style="margin-top:12px;font-size:14px;line-height:1.8;color:#766b5a;">
                                                            {{ $body }}
                                                        </div>
                                                    @endif
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                <tr>
                                    <td style="padding:0 32px 28px;">
                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-radius:26px;border:1px solid #eadfce;background:#fffaf3;">
                                            <tr>
                                                <td style="padding:22px 24px;">
                                                    <div style="font-size:11px;line-height:1.4;letter-spacing:0.28em;text-transform:uppercase;color:#948774;">
                                                        Workspace briefing
                                                    </div>

                                                    @if ($details)
                                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:14px;">
                                                            @foreach ($details as $detail)
                                                                <tr>
                                                                    <td style="padding:10px 0;border-bottom:{{ $loop->last ? '0' : '1px solid #efe5d6' }};">
                                                                        <div style="font-size:11px;line-height:1.4;letter-spacing:0.18em;text-transform:uppercase;color:#9e917d;">
                                                                            {{ $detail['label'] }}
                                                                        </div>
                                                                        <div style="margin-top:6px;font-size:16px;line-height:1.6;font-weight:600;color:#1c1610;">
                                                                            {{ $detail['value'] }}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            @endforeach
                                                        </table>
                                                    @else
                                                        <div style="margin-top:14px;font-size:14px;line-height:1.8;color:#766b5a;">
                                                            Secure delivery from your workspace. Open the action below to continue.
                                                        </div>
                                                    @endif
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                @if ($highlights)
                                    <tr>
                                        <td style="padding:0 32px 10px;">
                                            <div style="font-size:11px;line-height:1.4;letter-spacing:0.28em;text-transform:uppercase;color:#948774;">
                                                Highlights
                                            </div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding:0 32px 22px;">
                                            @foreach ($highlights as $highlight)
                                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:{{ $loop->first ? '0' : '12px' }};border-radius:24px;border:1px solid #ebe0d1;background:#ffffff;">
                                                    <tr>
                                                        <td style="padding:18px 20px;">
                                                            <div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.2;font-weight:700;color:#17120c;">
                                                                {{ $highlight['title'] }}
                                                            </div>
                                                            @if (!empty($highlight['text']))
                                                                <div style="margin-top:8px;font-size:14px;line-height:1.75;color:#766b5a;">
                                                                    {{ $highlight['text'] }}
                                                                </div>
                                                            @endif
                                                        </td>
                                                    </tr>
                                                </table>
                                            @endforeach
                                        </td>
                                    </tr>
                                @endif

                                <tr>
                                    <td style="padding:0 32px 34px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0">
                                            <tr>
                                                <td>
                                                    <a href="{{ $actionUrl }}" style="display:inline-block;border-radius:999px;background:#17120c;color:#f8f2e8;text-decoration:none;padding:15px 28px;font-size:14px;font-weight:700;letter-spacing:0.04em;">
                                                        {{ $actionLabel }}
                                                    </a>
                                                </td>
                                            </tr>
                                        </table>
                                        <div style="margin-top:14px;font-size:12px;line-height:1.7;color:#8a7d6b;">
                                            If the button does not open, copy and paste this link into your browser:
                                        </div>
                                        <div style="margin-top:6px;font-size:12px;line-height:1.7;word-break:break-all;">
                                            <a href="{{ $actionUrl }}" style="color:#7b5c2d;text-decoration:none;">{{ $actionUrl }}</a>
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:18px 16px 0;text-align:center;">
                            <div style="font-size:12px;line-height:1.8;color:#766b5a;">
                                {{ $footer }}
                            </div>
                            <div style="margin-top:8px;font-size:11px;line-height:1.8;letter-spacing:0.16em;text-transform:uppercase;color:#9e917d;">
                                {{ $brandName }} - Curated workspace delivery
                            </div>
                            <div style="margin-top:6px;font-size:12px;line-height:1.8;">
                                <a href="{{ $appUrl }}" style="color:#7b5c2d;text-decoration:none;">{{ $appUrl }}</a>
                            </div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
