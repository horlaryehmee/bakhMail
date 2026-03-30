<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BrandingSetting extends Model
{
    use HasFactory;

    protected $fillable = [
        'key',
        'brand_name',
        'logo_url',
        'logo_size',
    ];

    protected function casts(): array
    {
        return [
            'logo_size' => 'float',
        ];
    }
}
