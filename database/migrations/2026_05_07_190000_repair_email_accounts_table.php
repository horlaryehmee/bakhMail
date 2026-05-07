<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('email_accounts')) {
            return;
        }

        Schema::create('email_accounts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('from_name')->nullable();
            $table->string('email_address');
            $table->string('reply_to_address')->nullable();
            $table->string('provider')->default('custom');
            $table->string('status')->default('active')->index();
            $table->string('smtp_host')->nullable();
            $table->unsignedSmallInteger('smtp_port')->nullable();
            $table->string('smtp_encryption')->nullable();
            $table->string('smtp_username')->nullable();
            $table->text('smtp_password')->nullable();
            $table->string('imap_host')->nullable();
            $table->unsignedSmallInteger('imap_port')->nullable();
            $table->string('imap_encryption')->nullable();
            $table->string('imap_username')->nullable();
            $table->text('imap_password')->nullable();
            $table->string('oauth_provider')->nullable();
            $table->text('oauth_access_token')->nullable();
            $table->text('oauth_refresh_token')->nullable();
            $table->timestamp('oauth_expires_at')->nullable();
            $table->boolean('warmup_enabled')->default(false);
            $table->string('warmup_target_email')->nullable();
            $table->unsignedSmallInteger('daily_limit')->default(150);
            $table->unsignedSmallInteger('hourly_limit')->default(25);
            $table->unsignedTinyInteger('health_score')->default(100);
            $table->timestamp('last_synced_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'email_address']);
        });
    }

    public function down(): void
    {
        // Intentionally left blank. This migration repairs missing production state.
    }
};
