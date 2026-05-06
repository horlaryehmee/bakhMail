@php
    $brandName = $branding['brandName'] ?? config('app.name', 'BakhMail');
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
<body style="margin:0;padding:0;background:#edf2f9;color:#111827;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
        {{ $preheader }}
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#edf2f9;padding:28px 12px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:700px;">
                    <tr>
                        <td style="padding-bottom:14px;text-align:center;">
                            <div style="display:inline-block;border-radius:999px;background:#dbe7ff;color:#2851c3;padding:8px 14px;font-size:11px;line-height:1.4;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;">
                                {{ $eyebrow }}
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0;background:#ffffff;border:1px solid #dce5f2;border-radius:30px;overflow:hidden;box-shadow:0 28px 72px rgba(15,23,42,0.10);">
                                <tr>
                                    <td style="padding:0;">
                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f172a;">
                                            <tr>
                                                <td style="padding:28px 30px 10px;">
                                                    <table role="presentation" cellspacing="0" cellpadding="0">
                                                        <tr>
                                                            <td style="vertical-align:middle;">
                                                                @if ($logoUrl)
                                                                    <img src="{{ $logoUrl }}" alt="{{ $brandName }} logo" style="display:block;max-width:56px;max-height:56px;border-radius:18px;border:1px solid rgba(255,255,255,0.10);background:#0b1321;">
                                                                @else
                                                                    <div style="width:56px;height:56px;border-radius:18px;background:#84cc16;color:#07111f;font-size:20px;font-weight:800;line-height:56px;text-align:center;">
                                                                        {{ strtoupper(substr($brandName, 0, 1)) }}
                                                                    </div>
                                                                @endif
                                                            </td>
                                                            <td style="padding-left:14px;vertical-align:middle;">
                                                                <div style="font-size:11px;line-height:1.4;letter-spacing:0.18em;text-transform:uppercase;color:#8fa2c1;">
                                                                    Workspace signal
                                                                </div>
                                                                <div style="margin-top:6px;font-size:20px;line-height:1.2;font-weight:700;color:#f8fbff;">
                                                                    {{ $brandName }}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding:12px 30px 32px;background:
                                                    radial-gradient(circle at top right, rgba(96,165,250,0.18), transparent 30%),
                                                    radial-gradient(circle at left bottom, rgba(132,204,22,0.16), transparent 26%),
                                                    linear-gradient(180deg, rgba(15,23,42,1) 0%, rgba(15,23,42,0.96) 100%);">
                                                    @if ($recipientName)
                                                        <div style="margin:0 0 14px;font-size:13px;line-height:1.6;color:#c2d0e7;">
                                                            Hello {{ $recipientName }},
                                                        </div>
                                                    @endif

                                                    <div style="margin:0;font-size:38px;line-height:1.05;font-weight:800;letter-spacing:-0.03em;color:#ffffff;">
                                                        {{ $headline }}
                                                    </div>

                                                    @if ($intro)
                                                        <div style="margin-top:16px;max-width:560px;font-size:16px;line-height:1.75;color:#d4deef;">
                                                            {{ $intro }}
                                                        </div>
                                                    @endif

                                                    @if ($body)
                                                        <div style="margin-top:12px;max-width:560px;font-size:14px;line-height:1.75;color:#91a4c1;">
                                                            {{ $body }}
                                                        </div>
                                                    @endif
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>

                                @if ($details)
                                    <tr>
                                        <td style="padding:26px 30px 8px;">
                                            <div style="font-size:11px;line-height:1.4;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#94a3b8;">
                                                Details
                                            </div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding:0 30px 10px;">
                                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                                @foreach ($details as $detail)
                                                    <tr>
                                                        <td style="padding:0 0 10px;vertical-align:top;">
                                                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e2eaf5;border-radius:20px;background:#f8fbff;">
                                                                <tr>
                                                                    <td style="padding:16px 16px 15px;">
                                                                        <div style="font-size:10px;line-height:1.4;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#8ca0bc;">
                                                                            {{ $detail['label'] }}
                                                                        </div>
                                                                        <div style="margin-top:8px;font-size:15px;line-height:1.55;font-weight:700;color:#0f172a;">
                                                                            {{ $detail['value'] }}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            </table>
                                                        </td>
                                                    </tr>
                                                @endforeach
                                            </table>
                                        </td>
                                    </tr>
                                @endif

                                @if ($highlights)
                                    <tr>
                                        <td style="padding:18px 30px 8px;">
                                            <div style="font-size:11px;line-height:1.4;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#94a3b8;">
                                                Highlights
                                            </div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding:0 30px 10px;">
                                            @foreach ($highlights as $highlight)
                                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:12px;border:1px solid #e2eaf5;border-radius:22px;background:#ffffff;">
                                                    <tr>
                                                        <td style="padding:18px 18px 18px 22px;border-left:5px solid #4f8ef7;">
                                                            <div style="font-size:18px;line-height:1.35;font-weight:800;color:#0f172a;">
                                                                {{ $highlight['title'] }}
                                                            </div>
                                                            @if (!empty($highlight['text']))
                                                                <div style="margin-top:7px;font-size:14px;line-height:1.7;color:#64748b;">
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
                                    <td style="padding:18px 30px 34px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0">
                                            <tr>
                                                <td>
                                                    <a href="{{ $actionUrl }}" style="display:inline-block;border-radius:999px;background:#2563eb;color:#ffffff;text-decoration:none;padding:15px 24px;font-size:14px;font-weight:800;letter-spacing:0.02em;">
                                                        {{ $actionLabel }}
                                                    </a>
                                                </td>
                                            </tr>
                                        </table>
                                        <div style="margin-top:14px;font-size:12px;line-height:1.75;color:#94a3b8;">
                                            If the button does not open, copy and paste this link into your browser:
                                        </div>
                                        <div style="margin-top:6px;font-size:12px;line-height:1.75;word-break:break-all;">
                                            <a href="{{ $actionUrl }}" style="color:#2563eb;text-decoration:none;">{{ $actionUrl }}</a>
                                        </div>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:18px 18px 0;text-align:center;">
                            <div style="font-size:12px;line-height:1.8;color:#64748b;">
                                {{ $footer }}
                            </div>
                            <div style="margin-top:8px;font-size:11px;line-height:1.8;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#94a3b8;">
                                {{ $brandName }} - Workspace notification
                            </div>
                            <div style="margin-top:6px;font-size:12px;line-height:1.8;">
                                <a href="{{ $appUrl }}" style="color:#2563eb;text-decoration:none;">{{ $appUrl }}</a>
                            </div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
