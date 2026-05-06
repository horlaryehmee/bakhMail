<?php

namespace App\Services;

class DeliverabilityService
{
    public function inspectDomain(string $domain): array
    {
        $domain = strtolower(trim($domain));
        $txtRecords = dns_get_record($domain, DNS_TXT) ?: [];
        $dmarcRecords = dns_get_record('_dmarc.'.$domain, DNS_TXT) ?: [];
        $dkimRecords = dns_get_record('default._domainkey.'.$domain, DNS_TXT) ?: [];

        $spf = collect($txtRecords)->pluck('txt')->first(fn ($value) => str_starts_with($value, 'v=spf1'));
        $dmarc = collect($dmarcRecords)->pluck('txt')->first(fn ($value) => str_starts_with($value, 'v=DMARC1'));
        $dkim = collect($dkimRecords)->pluck('txt')->first(fn ($value) => str_contains($value, 'k=rsa'));

        return [
            'domain' => $domain,
            'spf' => [
                'record' => $spf,
                'status' => $spf ? 'configured' : 'missing',
            ],
            'dmarc' => [
                'record' => $dmarc,
                'status' => $dmarc ? 'configured' : 'missing',
            ],
            'dkim' => [
                'record' => $dkim,
                'status' => $dkim ? 'configured' : 'missing',
            ],
            'score' => collect([$spf, $dmarc, $dkim])->filter()->count() * 33,
        ];
    }
}
