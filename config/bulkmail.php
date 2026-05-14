<?php

return [
    'tracking_base_url' => env('TRACKING_BASE_URL', env('APP_URL')),
    'warmup_default_recipient' => env('WARMUP_DEFAULT_RECIPIENT'),
    'suppression_retention_days' => (int) env('SUPPRESSION_RETENTION_DAYS', 365),
    'smtp_timeout_seconds' => (int) env('SMTP_TIMEOUT_SECONDS', 8),
    'default_timezone' => env('APP_TIMEZONE', 'UTC'),
];
