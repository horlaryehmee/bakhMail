<?php
// Check PHP version
if (version_compare(PHP_VERSION, '8.3.0', '<')) {
    die('PHP 8.3+ required. Current: ' . PHP_VERSION);
}

// Check .env
$envPath = __DIR__ . '/../.env';
if (!file_exists($envPath)) {
    die('.env file missing');
}

// Check vendor
$vendorPath = __DIR__ . '/../vendor/autoload.php';
if (!file_exists($vendorPath)) {
    die('Vendor dependencies missing');
}

// Check storage permissions
$storagePath = __DIR__ . '/../storage';
if (!is_writable($storagePath)) {
    die('Storage directory not writable');
}

// Try loading Laravel
require $vendorPath;
$app = require_once __DIR__ . '/../bootstrap/app.php';

echo "All checks passed! Laravel is ready.";
?>