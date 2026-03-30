<?php

namespace App\Support;

class EnvironmentFile
{
    public static function path(): string
    {
        return base_path('.env');
    }

    public static function writable(): bool
    {
        $path = static::path();

        if (file_exists($path)) {
            return is_writable($path);
        }

        return is_writable(base_path());
    }

    public static function write(array $values): void
    {
        $path = static::path();
        $contents = file_exists($path)
            ? (string) file_get_contents($path)
            : (file_exists(base_path('.env.example')) ? (string) file_get_contents(base_path('.env.example')) : '');

        foreach ($values as $key => $value) {
            $escapedKey = preg_quote($key, '/');
            $line = $key.'='.static::formatValue($value);

            if (preg_match("/^{$escapedKey}=.*$/m", $contents) === 1) {
                $contents = (string) preg_replace("/^{$escapedKey}=.*$/m", $line, $contents, 1);
                continue;
            }

            $contents = rtrim($contents).PHP_EOL.$line.PHP_EOL;
        }

        file_put_contents($path, $contents);
    }

    private static function formatValue(mixed $value): string
    {
        if (is_bool($value)) {
            return $value ? 'true' : 'false';
        }

        if ($value === null) {
            return 'null';
        }

        $string = str_replace(['\\', '\''], ['\\\\', '\\\''], (string) $value);

        return "'{$string}'";
    }
}
