<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Str;

class TwoFactorService
{
    private const PERIOD = 30;

    public function generateSecret(int $length = 32): string
    {
        $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $secret = '';

        for ($index = 0; $index < $length; $index++) {
            $secret .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        }

        return $secret;
    }

    public function provisioningUri(User $user, string $secret): string
    {
        $issuer = rawurlencode(config('app.name'));
        $label = rawurlencode(config('app.name').':'.$user->email);

        return "otpauth://totp/{$label}?secret={$secret}&issuer={$issuer}&period=".self::PERIOD.'&digits=6';
    }

    public function generateRecoveryCodes(int $count = 8): array
    {
        return collect(range(1, $count))
            ->map(fn () => strtoupper(Str::random(10)))
            ->all();
    }

    public function verify(string $secret, string $code): bool
    {
        $code = preg_replace('/\s+/', '', $code);

        foreach ([-1, 0, 1] as $offset) {
            if (hash_equals($this->totp($secret, time() + ($offset * self::PERIOD)), $code)) {
                return true;
            }
        }

        return false;
    }

    private function totp(string $secret, int $timestamp): string
    {
        $counter = intdiv($timestamp, self::PERIOD);
        $binarySecret = $this->decodeBase32($secret);
        $binaryCounter = pack('N*', 0, $counter);
        $hash = hash_hmac('sha1', $binaryCounter, $binarySecret, true);
        $offset = ord(substr($hash, -1)) & 0x0F;
        $value = unpack('N', substr($hash, $offset, 4))[1] & 0x7FFFFFFF;

        return str_pad((string) ($value % 1000000), 6, '0', STR_PAD_LEFT);
    }

    private function decodeBase32(string $secret): string
    {
        $alphabet = array_flip(str_split('ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'));
        $secret = strtoupper(preg_replace('/[^A-Z2-7]/', '', $secret) ?? '');
        $buffer = 0;
        $bits = 0;
        $binary = '';

        foreach (str_split($secret) as $character) {
            $buffer = ($buffer << 5) | $alphabet[$character];
            $bits += 5;

            if ($bits >= 8) {
                $bits -= 8;
                $binary .= chr(($buffer >> $bits) & 0xFF);
            }
        }

        return $binary;
    }
}
