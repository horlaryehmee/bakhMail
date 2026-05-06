<?php

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Schedule::command('campaigns:dispatch')->everyMinute()->withoutOverlapping();
Schedule::command('campaigns:sync-replies')->everyFiveMinutes()->withoutOverlapping();
Schedule::command('campaigns:warmup')->hourly()->withoutOverlapping();
