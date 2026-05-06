<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            if (! Schema::hasColumn('users', 'title')) {
                $table->string('title')->default('')->after('role');
            }

            if (! Schema::hasColumn('users', 'avatar_url')) {
                $table->string('avatar_url')->default('')->after('title');
            }

            if (! Schema::hasColumn('users', 'notification_preferences')) {
                $table->json('notification_preferences')->nullable()->after('avatar_url');
            }

            if (! Schema::hasColumn('users', 'is_active')) {
                $table->boolean('is_active')->default(true)->after('notification_preferences');
            }

            if (! Schema::hasColumn('users', 'api_token')) {
                $table->string('api_token', 128)->nullable()->unique()->after('remember_token');
            }

            if (! Schema::hasColumn('users', 'demo_data')) {
                $table->boolean('demo_data')->default(false)->after('api_token');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $columns = array_values(array_filter([
                Schema::hasColumn('users', 'title') ? 'title' : null,
                Schema::hasColumn('users', 'avatar_url') ? 'avatar_url' : null,
                Schema::hasColumn('users', 'notification_preferences') ? 'notification_preferences' : null,
                Schema::hasColumn('users', 'is_active') ? 'is_active' : null,
                Schema::hasColumn('users', 'api_token') ? 'api_token' : null,
                Schema::hasColumn('users', 'demo_data') ? 'demo_data' : null,
            ]));

            if ($columns !== []) {
                $table->dropColumn($columns);
            }
        });
    }
};
