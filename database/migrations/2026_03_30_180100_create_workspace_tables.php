<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Legacy workspace tables were removed from the active BakhMail product,
        // but branding_settings is still used by the installer and mail views.
        if (! Schema::hasTable('branding_settings')) {
            Schema::create('branding_settings', function (Blueprint $table): void {
                $table->id();
                $table->string('key')->unique()->default('branding');
                $table->string('brand_name', 80)->default('BakhMail');
                $table->string('logo_url')->default('');
                $table->float('logo_size')->default(1);
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('branding_settings');
    }
};
