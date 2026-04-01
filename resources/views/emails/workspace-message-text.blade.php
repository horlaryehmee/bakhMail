@php
    $brandName = $branding['brandName'] ?? config('app.name', 'TaskManager');
    $headline = $messageData['headline'] ?? ($messageData['subject'] ?? $brandName);
    $subject = $messageData['subject'] ?? $headline;
    $actionUrl = $messageData['actionUrl'] ?? ($branding['appUrl'] ?? config('app.url'));
    $actionLabel = $messageData['actionLabel'] ?? 'Open workspace';
@endphp
{{ $subject }}

{{ $headline }}

@if(!empty($messageData['recipientName']))
Hello {{ $messageData['recipientName'] }},

@endif
@if(!empty($messageData['intro']))
{{ $messageData['intro'] }}

@endif
@if(!empty($messageData['body']))
{{ $messageData['body'] }}

@endif
@if(!empty($messageData['details']))
Workspace briefing
@foreach($messageData['details'] as $detail)
- {{ $detail['label'] }}: {{ $detail['value'] }}
@endforeach

@endif
@if(!empty($messageData['highlights']))
Highlights
@foreach($messageData['highlights'] as $highlight)
- {{ $highlight['title'] }}@if(!empty($highlight['text'])) - {{ $highlight['text'] }}@endif
@endforeach

@endif
{{ $actionLabel }}: {{ $actionUrl }}

{{ $messageData['footer'] ?? 'You can manage your workspace from the dashboard at any time.' }}

{{ $brandName }}
{{ $branding['appUrl'] ?? config('app.url') }}
