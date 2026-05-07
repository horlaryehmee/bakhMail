<?php

namespace App\Support;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Throwable;

class EmailAccountSchemaManager
{
    public function ensureReady(): void
    {
        $this->ensureDatabaseConnection();
        $this->ensureUsersTable();

        if (! Schema::hasTable('email_accounts')) {
            $this->createEmailAccountsTable();
        } else {
            $this->repairEmailAccountsTable();
        }
    }

    private function ensureDatabaseConnection(): void
    {
        try {
            DB::connection()->getPdo();
        } catch (Throwable $exception) {
            throw new HttpResponseException(response()->json([
                'message' => 'Database connection is not available for mailbox accounts. Check the live database settings and try again.',
            ], 503));
        }
    }

    private function ensureUsersTable(): void
    {
        if (Schema::hasTable('users')) {
            return;
        }

        throw new HttpResponseException(response()->json([
            'message' => 'The users table is missing on this server, so mailbox accounts cannot be attached yet. Run the application migrations first.',
        ], 503));
    }

    private function createEmailAccountsTable(): void
    {
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

    private function repairEmailAccountsTable(): void
    {
        Schema::table('email_accounts', function (Blueprint $table): void {
            if (! Schema::hasColumn('email_accounts', 'user_id')) {
                $table->foreignId('user_id')->nullable()->after('id')->constrained()->nullOnDelete();
            }

            if (! Schema::hasColumn('email_accounts', 'name')) {
                $table->string('name')->default('Mailbox')->after('user_id');
            }

            if (! Schema::hasColumn('email_accounts', 'from_name')) {
                $table->string('from_name')->nullable()->after('name');
            }

            if (! Schema::hasColumn('email_accounts', 'email_address')) {
                $table->string('email_address')->default('')->after('from_name');
            }

            if (! Schema::hasColumn('email_accounts', 'reply_to_address')) {
                $table->string('reply_to_address')->nullable()->after('email_address');
            }

            if (! Schema::hasColumn('email_accounts', 'provider')) {
                $table->string('provider')->default('custom')->after('reply_to_address');
            }

            if (! Schema::hasColumn('email_accounts', 'status')) {
                $table->string('status')->default('active')->after('provider');
            }

            if (! Schema::hasColumn('email_accounts', 'smtp_host')) {
                $table->string('smtp_host')->nullable()->after('status');
            }

            if (! Schema::hasColumn('email_accounts', 'smtp_port')) {
                $table->unsignedSmallInteger('smtp_port')->nullable()->after('smtp_host');
            }

            if (! Schema::hasColumn('email_accounts', 'smtp_encryption')) {
                $table->string('smtp_encryption')->nullable()->after('smtp_port');
            }

            if (! Schema::hasColumn('email_accounts', 'smtp_username')) {
                $table->string('smtp_username')->nullable()->after('smtp_encryption');
            }

            if (! Schema::hasColumn('email_accounts', 'smtp_password')) {
                $table->text('smtp_password')->nullable()->after('smtp_username');
            }

            if (! Schema::hasColumn('email_accounts', 'imap_host')) {
                $table->string('imap_host')->nullable()->after('smtp_password');
            }

            if (! Schema::hasColumn('email_accounts', 'imap_port')) {
                $table->unsignedSmallInteger('imap_port')->nullable()->after('imap_host');
            }

            if (! Schema::hasColumn('email_accounts', 'imap_encryption')) {
                $table->string('imap_encryption')->nullable()->after('imap_port');
            }

            if (! Schema::hasColumn('email_accounts', 'imap_username')) {
                $table->string('imap_username')->nullable()->after('imap_encryption');
            }

            if (! Schema::hasColumn('email_accounts', 'imap_password')) {
                $table->text('imap_password')->nullable()->after('imap_username');
            }

            if (! Schema::hasColumn('email_accounts', 'oauth_provider')) {
                $table->string('oauth_provider')->nullable()->after('imap_password');
            }

            if (! Schema::hasColumn('email_accounts', 'oauth_access_token')) {
                $table->text('oauth_access_token')->nullable()->after('oauth_provider');
            }

            if (! Schema::hasColumn('email_accounts', 'oauth_refresh_token')) {
                $table->text('oauth_refresh_token')->nullable()->after('oauth_access_token');
            }

            if (! Schema::hasColumn('email_accounts', 'oauth_expires_at')) {
                $table->timestamp('oauth_expires_at')->nullable()->after('oauth_refresh_token');
            }

            if (! Schema::hasColumn('email_accounts', 'warmup_enabled')) {
                $table->boolean('warmup_enabled')->default(false)->after('oauth_expires_at');
            }

            if (! Schema::hasColumn('email_accounts', 'warmup_target_email')) {
                $table->string('warmup_target_email')->nullable()->after('warmup_enabled');
            }

            if (! Schema::hasColumn('email_accounts', 'daily_limit')) {
                $table->unsignedSmallInteger('daily_limit')->default(150)->after('warmup_target_email');
            }

            if (! Schema::hasColumn('email_accounts', 'hourly_limit')) {
                $table->unsignedSmallInteger('hourly_limit')->default(25)->after('daily_limit');
            }

            if (! Schema::hasColumn('email_accounts', 'health_score')) {
                $table->unsignedTinyInteger('health_score')->default(100)->after('hourly_limit');
            }

            if (! Schema::hasColumn('email_accounts', 'last_synced_at')) {
                $table->timestamp('last_synced_at')->nullable()->after('health_score');
            }

            if (! Schema::hasColumn('email_accounts', 'metadata')) {
                $table->json('metadata')->nullable()->after('last_synced_at');
            }

            if (! Schema::hasColumn('email_accounts', 'created_at') || ! Schema::hasColumn('email_accounts', 'updated_at')) {
                $table->timestamps();
            }
        });
    }
}
