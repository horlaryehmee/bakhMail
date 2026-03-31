{{ $messageData['headline'] ?? ($messageData['subject'] ?? ($branding['brandName'] ?? config('app.name', 'TaskManager'))) }}

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
@foreach($messageData['details'] as $detail)
{{ $detail['label'] }}: {{ $detail['value'] }}
@endforeach

@endif
@if(!empty($messageData['highlights']))
@foreach($messageData['highlights'] as $highlight)
- {{ $highlight['title'] }}@if(!empty($highlight['text'])) — {{ $highlight['text'] }}@endif
@endforeach

@endif
{{ $messageData['actionLabel'] ?? 'Open workspace' }}: {{ $messageData['actionUrl'] ?? ($branding['appUrl'] ?? config('app.url')) }}

{{ $messageData['footer'] ?? 'You can manage your workspace from the dashboard at any time.' }}
