<?php
require __DIR__.'/../vendor/autoload.php';
$app = require __DIR__.'/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();
foreach (App\Models\EmailAccount::query()->get(['id','email_address','provider','smtp_host','smtp_port','smtp_encryption','imap_host','imap_port','status']) as $account) {
    echo json_encode($account->toArray(), JSON_UNESCAPED_SLASHES), PHP_EOL;
}
