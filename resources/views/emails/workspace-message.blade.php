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
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ $messageData['subject'] ?? $brandName }}</title>
</head>
<body style="margin:0;padding:0;background:#edf3f7;color:#0f172a;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#edf3f7;padding:28px 12px;">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;">
                    <tr>
                        <td style="padding-bottom:18px;text-align:center;">
                            <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto;">
                                <tr>
                                    <td style="padding:0 0 14px;">
                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-radius:32px;background:linear-gradient(180deg,#0a1220 0%,#0c1627 100%);border:1px solid rgba(38,57,86,0.6);box-shadow:0 26px 60px rgba(9,18,31,0.24);overflow:hidden;">
                                            <tr>
                                                <td style="padding:32px 34px;">
                                                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                                        <tr>
                                                            <td style="padding-bottom:22px;">
                                                                <table role="presentation" cellspacing="0" cellpadding="0">
                                                                    <tr>
                                                                        <td style="vertical-align:middle;">
                                                                            @if ($logoUrl)
                                                                                <img src="{{ $logoUrl }}" alt="{{ $brandName }} logo" style="display:block;max-width:56px;max-height:56px;border-radius:14px;">
                                                                            @else
                                                                                <div style="width:56px;height:56px;border-radius:16px;background:#92e10f;color:#08111f;font-size:22px;font-weight:700;line-height:56px;text-align:center;">
                                                                                    {{ strtoupper(substr($brandName, 0, 1)) }}
                                                                                </div>
                                                                            @endif
                                                                        </td>
                                                                        <td style="padding-left:14px;vertical-align:middle;">
                                                                            <div style="font-size:11px;line-height:1.4;letter-spacing:0.28em;text-transform:uppercase;color:#97a8c0;">{{ $eyebrow }}</div>
                                                                            <div style="margin-top:6px;font-size:20px;line-height:1.2;font-weight:700;color:#f8fbff;">{{ $brandName }}</div>
                                                                        </td>
                                                                    </tr>
                                                                </table>
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td>
                                                                @if ($recipientName)
                                                                    <div style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#cad6e5;">Hello {{ $recipientName }},</div>
                                                                @endif
                                                                <div style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:36px;line-height:1.06;font-weight:600;color:#ffffff;">
                                                                    {{ $headline }}
                                                                </div>
                                                                @if ($intro)
                                                                    <div style="margin-top:16px;font-size:15px;line-height:1.75;color:#c6d3e3;">
                                                                        {{ $intro }}
                                                                    </div>
                                                                @endif
                                                                @if ($body)
                                                                    <div style="margin-top:12px;font-size:14px;line-height:1.75;color:#97a8c0;">
                                                                        {{ $body }}
                                                                    </div>
                                                                @endif
                                                            </td>
                                                        </tr>
                                                        @if ($details)
                                                            <tr>
                                                                <td style="padding-top:22px;">
                                                                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-radius:24px;background:rgba(10,18,32,0.72);border:1px solid rgba(56,74,106,0.7);">
                                                                        @foreach ($details as $detail)
                                                                            <tr>
                                                                                <td style="padding:14px 18px;border-bottom:{{ $loop->last ? '0' : '1px solid rgba(56,74,106,0.5)' }};">
                                                                                    <div style="font-size:11px;line-height:1.4;letter-spacing:0.22em;text-transform:uppercase;color:#8193ab;">{{ $detail['label'] }}</div>
                                                                                    <div style="margin-top:6px;font-size:15px;line-height:1.6;color:#f4f8fc;font-weight:600;">{{ $detail['value'] }}</div>
                                                                                </td>
                                                                            </tr>
                                                                        @endforeach
                                                                    </table>
                                                                </td>
                                                            </tr>
                                                        @endif
                                                        @if ($highlights)
                                                            <tr>
                                                                <td style="padding-top:22px;">
                                                                    @foreach ($highlights as $highlight)
                                                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:{{ $loop->first ? '0' : '10px' }};border-radius:22px;background:rgba(255,255,255,0.04);border:1px solid rgba(56,74,106,0.55);">
                                                                            <tr>
                                                                                <td style="padding:16px 18px;">
                                                                                    <div style="font-size:17px;line-height:1.35;font-weight:700;color:#f8fbff;">{{ $highlight['title'] }}</div>
                                                                                    @if (!empty($highlight['text']))
                                                                                        <div style="margin-top:6px;font-size:13px;line-height:1.7;color:#97a8c0;">{{ $highlight['text'] }}</div>
                                                                                    @endif
                                                                                </td>
                                                                            </tr>
                                                                        </table>
                                                                    @endforeach
                                                                </td>
                                                            </tr>
                                                        @endif
                                                        <tr>
                                                            <td style="padding-top:26px;">
                                                                <a href="{{ $actionUrl }}" style="display:inline-block;padding:14px 22px;border-radius:999px;background:linear-gradient(180deg,#b7ff33 0%,#96db1a 100%);color:#08111f;text-decoration:none;font-size:14px;font-weight:800;">
                                                                    {{ $actionLabel }}
                                                                </a>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:0 12px;text-align:center;">
                            <div style="font-size:12px;line-height:1.75;color:#6b7c94;">
                                {{ $footer }}
                            </div>
                            <div style="margin-top:10px;font-size:12px;line-height:1.75;color:#8193ab;">
                                {{ $brandName }} · <a href="{{ $appUrl }}" style="color:#276ef1;text-decoration:none;">{{ $appUrl }}</a>
                            </div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
