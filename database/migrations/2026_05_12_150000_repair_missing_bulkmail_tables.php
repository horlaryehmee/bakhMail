<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->createEmailAccountsTable();
        $this->createContactsTable();
        $this->createContactGroupsTable();
        $this->createContactGroupMembersTable();
        $this->createTagsTable();
        $this->createContactTagTable();
        $this->createCampaignsTable();
        $this->createCampaignStepsTable();
        $this->createCampaignRecipientsTable();
        $this->createConversationThreadsTable();
        $this->createEmailLogsTable();
        $this->createTrackingEventsTable();
        $this->createSuppressionEntriesTable();
        $this->createActivityLogsTable();
        $this->createAnalyticsSnapshotsTable();
        $this->createAppSettingsTable();
    }

    public function down(): void
    {
        // This repair migration only creates missing tables on broken installs.
        // It should not drop tables on rollback.
    }

    private function createEmailAccountsTable(): void
    {
        if (Schema::hasTable('email_accounts')) {
            return;
        }

        Schema::create('email_accounts', function (Blueprint $table) {
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

    private function createContactsTable(): void
    {
        if (Schema::hasTable('contacts')) {
            return;
        }

        Schema::create('contacts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('first_name')->nullable();
            $table->string('last_name')->nullable();
            $table->string('email');
            $table->string('company')->nullable();
            $table->string('job_title')->nullable();
            $table->string('phone')->nullable();
            $table->string('website')->nullable();
            $table->string('location')->nullable();
            $table->text('notes')->nullable();
            $table->string('status')->default('active')->index();
            $table->string('unsubscribe_token')->unique();
            $table->json('custom_fields')->nullable();
            $table->timestamp('last_contacted_at')->nullable();
            $table->timestamp('replied_at')->nullable();
            $table->timestamp('bounced_at')->nullable();
            $table->timestamp('unsubscribed_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'email']);
        });
    }

    private function createContactGroupsTable(): void
    {
        if (Schema::hasTable('contact_groups')) {
            return;
        }

        Schema::create('contact_groups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('color')->default('#3b82f6');
            $table->text('description')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'name']);
        });
    }

    private function createContactGroupMembersTable(): void
    {
        if (Schema::hasTable('contact_group_members') || ! Schema::hasTable('contact_groups') || ! Schema::hasTable('contacts')) {
            return;
        }

        Schema::create('contact_group_members', function (Blueprint $table) {
            $table->foreignId('contact_group_id')->constrained('contact_groups')->cascadeOnDelete();
            $table->foreignId('contact_id')->constrained()->cascadeOnDelete();
            $table->primary(['contact_group_id', 'contact_id']);
        });
    }

    private function createTagsTable(): void
    {
        if (Schema::hasTable('tags')) {
            return;
        }

        Schema::create('tags', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('color')->default('#06b6d4');
            $table->timestamps();

            $table->unique(['user_id', 'name']);
        });
    }

    private function createContactTagTable(): void
    {
        if (Schema::hasTable('contact_tag') || ! Schema::hasTable('contacts') || ! Schema::hasTable('tags')) {
            return;
        }

        Schema::create('contact_tag', function (Blueprint $table) {
            $table->foreignId('contact_id')->constrained()->cascadeOnDelete();
            $table->foreignId('tag_id')->constrained()->cascadeOnDelete();
            $table->primary(['contact_id', 'tag_id']);
        });
    }

    private function createCampaignsTable(): void
    {
        if (Schema::hasTable('campaigns')) {
            return;
        }

        Schema::create('campaigns', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('subject');
            $table->string('preview_text')->nullable();
            $table->string('status')->default('draft')->index();
            $table->string('builder_type')->default('visual');
            $table->json('audience_filters')->nullable();
            $table->longText('template_html');
            $table->longText('template_text')->nullable();
            $table->json('settings')->nullable();
            $table->json('selected_email_account_ids')->nullable();
            $table->unsignedInteger('total_recipients')->default(0);
            $table->timestamp('scheduled_at')->nullable()->index();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });
    }

    private function createCampaignStepsTable(): void
    {
        if (Schema::hasTable('campaign_steps') || ! Schema::hasTable('campaigns')) {
            return;
        }

        Schema::create('campaign_steps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campaign_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->unsignedTinyInteger('step_order');
            $table->string('subject');
            $table->longText('body_html');
            $table->longText('body_text')->nullable();
            $table->unsignedInteger('delay_hours')->default(0);
            $table->json('send_window')->nullable();
            $table->boolean('stop_on_reply')->default(true);
            $table->boolean('stop_on_click')->default(false);
            $table->json('conditions')->nullable();
            $table->timestamps();

            $table->unique(['campaign_id', 'step_order']);
        });
    }

    private function createCampaignRecipientsTable(): void
    {
        if (Schema::hasTable('campaign_recipients') || ! Schema::hasTable('campaigns') || ! Schema::hasTable('contacts')) {
            return;
        }

        Schema::create('campaign_recipients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('campaign_id')->constrained()->cascadeOnDelete();
            $table->foreignId('contact_id')->constrained()->cascadeOnDelete();
            $table->foreignId('email_account_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedTinyInteger('current_step_order')->default(0);
            $table->string('status')->default('queued')->index();
            $table->timestamp('scheduled_for')->nullable()->index();
            $table->timestamp('last_sent_at')->nullable();
            $table->timestamp('replied_at')->nullable();
            $table->timestamp('bounced_at')->nullable();
            $table->timestamp('unsubscribed_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['campaign_id', 'contact_id']);
        });
    }

    private function createConversationThreadsTable(): void
    {
        if (Schema::hasTable('conversation_threads') || ! Schema::hasTable('contacts')) {
            return;
        }

        Schema::create('conversation_threads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('contact_id')->constrained()->cascadeOnDelete();
            $table->foreignId('campaign_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('email_account_id')->nullable()->constrained()->nullOnDelete();
            $table->string('subject');
            $table->string('status')->default('open')->index();
            $table->timestamp('last_message_at')->nullable()->index();
            $table->timestamps();
        });
    }

    private function createEmailLogsTable(): void
    {
        if (Schema::hasTable('email_logs')) {
            return;
        }

        Schema::create('email_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('campaign_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('campaign_step_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('campaign_recipient_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('contact_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('email_account_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('conversation_thread_id')->nullable()->constrained('conversation_threads')->nullOnDelete();
            $table->string('direction')->index();
            $table->string('event_type')->index();
            $table->string('provider_message_id')->nullable()->index();
            $table->string('in_reply_to')->nullable()->index();
            $table->string('subject')->nullable();
            $table->string('recipient_email')->nullable()->index();
            $table->string('sender_email')->nullable()->index();
            $table->string('tracking_token')->nullable()->unique();
            $table->string('unsubscribe_token')->nullable();
            $table->text('body_preview')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->timestamp('opened_at')->nullable();
            $table->timestamp('clicked_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });
    }

    private function createTrackingEventsTable(): void
    {
        if (Schema::hasTable('tracking_events') || ! Schema::hasTable('email_logs')) {
            return;
        }

        Schema::create('tracking_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('email_log_id')->nullable()->constrained('email_logs')->nullOnDelete();
            $table->foreignId('campaign_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('contact_id')->nullable()->constrained()->nullOnDelete();
            $table->string('token')->nullable()->index();
            $table->string('event_type')->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    private function createSuppressionEntriesTable(): void
    {
        if (Schema::hasTable('suppression_entries')) {
            return;
        }

        Schema::create('suppression_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('email');
            $table->string('reason')->index();
            $table->string('source')->default('system');
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'email']);
        });
    }

    private function createActivityLogsTable(): void
    {
        if (Schema::hasTable('activity_logs')) {
            return;
        }

        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('action')->index();
            $table->string('subject_type')->nullable();
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->text('description')->nullable();
            $table->json('properties')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    private function createAnalyticsSnapshotsTable(): void
    {
        if (Schema::hasTable('analytics_snapshots') || ! Schema::hasTable('campaigns')) {
            return;
        }

        Schema::create('analytics_snapshots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('campaign_id')->nullable()->constrained()->nullOnDelete();
            $table->date('snapshot_date')->index();
            $table->unsignedInteger('sent_count')->default(0);
            $table->unsignedInteger('delivered_count')->default(0);
            $table->unsignedInteger('opened_count')->default(0);
            $table->unsignedInteger('clicked_count')->default(0);
            $table->unsignedInteger('replied_count')->default(0);
            $table->unsignedInteger('bounced_count')->default(0);
            $table->unsignedInteger('unsubscribed_count')->default(0);
            $table->timestamps();

            $table->unique(['user_id', 'campaign_id', 'snapshot_date']);
        });
    }

    private function createAppSettingsTable(): void
    {
        if (Schema::hasTable('app_settings')) {
            return;
        }

        Schema::create('app_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->json('value')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }
};
