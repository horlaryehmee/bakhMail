<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('role', 32)->default('client')->after('password');
            $table->string('title')->default('')->after('role');
            $table->string('avatar_url')->default('')->after('title');
            $table->json('notification_preferences')->nullable()->after('avatar_url');
            $table->boolean('is_active')->default(true)->after('notification_preferences');
            $table->string('api_token', 128)->nullable()->unique()->after('remember_token');
            $table->boolean('demo_data')->default(false)->after('api_token');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn([
                'role',
                'title',
                'avatar_url',
                'notification_preferences',
                'is_active',
                'api_token',
                'demo_data',
            ]);
        });
    }
};
