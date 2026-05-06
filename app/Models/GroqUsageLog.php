<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class GroqUsageLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'response_id',
        'model',
        'input_tokens',
        'output_tokens',
        'total_tokens',
        'request_payload',
        'response_metadata',
    ];

    protected function casts(): array
    {
        return [
            'request_payload' => 'array',
            'response_metadata' => 'array',
        ];
    }
}
