<?php
echo "PHP Version: " . phpversion() . "<br>";
echo "Document Root: " . $_SERVER['DOCUMENT_ROOT'] . "<br>";
echo "Current Dir: " . __DIR__ . "<br>";

// Check if .env exists
$envPath = __DIR__ . '/../.env';
echo ".env exists: " . (file_exists($envPath) ? 'Yes' : 'No') . "<br>";

// Check vendor
$vendorPath = __DIR__ . '/../vendor/autoload.php';
echo "Vendor autoload exists: " . (file_exists($vendorPath) ? 'Yes' : 'No') . "<br>";

// Try to load Laravel
if (file_exists($vendorPath)) {
    try {
        require $vendorPath;
        $app = require_once __DIR__ . '/../bootstrap/app.php';
        echo "Laravel loaded successfully<br>";
    } catch (Exception $e) {
        echo "Laravel error: " . $e->getMessage() . "<br>";
    }
}
?>