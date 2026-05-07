<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>{{ config('app.name') }}</title>
    @if (app()->environment(['local', 'testing']))
        @viteReactRefresh
    @endif
    @vite(['resources/css/app.css', 'resources/js/app.jsx'])
</head>
<body class="antialiased">
    @php($appData = [
        'user' => auth()->user() ? [
            'id' => auth()->id(),
            'name' => auth()->user()->name,
            'email' => auth()->user()->email,
            'role' => auth()->user()->role,
            'timezone' => auth()->user()->timezone,
            'avatar_color' => auth()->user()->avatar_color,
            'two_factor_enabled' => (bool) (auth()->user()->two_factor_secret && auth()->user()->two_factor_confirmed_at),
        ] : null,
        'csrfToken' => csrf_token(),
        'appName' => config('app.name'),
        'devMode' => app()->environment(['local', 'testing']),
        'demoAccounts' => app()->environment(['local', 'testing']) ? [
            [
                'label' => 'Admin demo',
                'email' => 'admin@bakhmail.test',
                'password' => 'password',
            ],
            [
                'label' => 'Operator demo',
                'email' => 'hello@bakhmail.test',
                'password' => 'password',
            ],
        ] : [],
    ])
    <div id="app"
        data-app='{{ json_encode($appData, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) }}'></div>
</body>
</html>
