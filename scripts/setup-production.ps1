$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath '.env')) {
    Copy-Item -LiteralPath '.env.example' -Destination '.env'
}

php artisan bakhmail:setup --force
