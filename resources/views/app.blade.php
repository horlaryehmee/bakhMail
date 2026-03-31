<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
        <meta name="color-scheme" content="light">
        <meta name="supported-color-schemes" content="light">

        <title inertia>{{ config('app.name', 'Project Workspace') }}</title>

        <script>
            (function () {
                try {
                    var storedTheme = window.localStorage.getItem('bakhtech.theme');
                    var resolvedTheme = storedTheme === 'dark' || storedTheme === 'light'
                        ? storedTheme
                        : 'light';

                    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
                    document.documentElement.style.colorScheme = 'light';
                    document.documentElement.dataset.theme = resolvedTheme;
                } catch (error) {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.style.colorScheme = 'light';
                    document.documentElement.dataset.theme = 'light';
                }
            })();
        </script>

        @viteReactRefresh
        @vite(['resources/js/app.jsx'])
        @inertiaHead
    </head>
    <body>
        @inertia
    </body>
</html>
