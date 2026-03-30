<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('projects', function (Blueprint $table): void {
            $table->id();
            $table->string('name', 120);
            $table->string('summary', 240)->default('');
            $table->text('description')->nullable();
            $table->string('status', 32)->default('not_started');
            $table->string('priority', 32)->default('medium');
            $table->string('type', 80)->default('Website');
            $table->json('tags')->nullable();
            $table->timestamp('start_date')->nullable();
            $table->timestamp('deadline')->nullable();
            $table->unsignedInteger('progress')->default(0);
            $table->string('preview_type', 32)->default('website');
            $table->string('preview_url')->default('');
            $table->string('preview_image_url')->default('');
            $table->string('preview_video_url')->default('');
            $table->json('attachments')->nullable();
            $table->foreignId('created_by_id')->constrained('users')->cascadeOnUpdate()->restrictOnDelete();
            $table->boolean('demo_data')->default(false);
            $table->timestamps();
            $table->index(['status', 'deadline']);
            $table->index('priority');
        });

        Schema::create('project_team_members', function (Blueprint $table): void {
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->primary(['project_id', 'user_id']);
        });

        Schema::create('project_clients', function (Blueprint $table): void {
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->primary(['project_id', 'user_id']);
        });

        Schema::create('tasks', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->string('title', 140);
            $table->text('description')->nullable();
            $table->string('status', 32)->default('todo');
            $table->string('priority', 32)->default('medium');
            $table->foreignId('assignee_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('reporter_id')->constrained('users')->restrictOnDelete();
            $table->timestamp('start_date')->nullable();
            $table->timestamp('due_date')->nullable();
            $table->boolean('milestone')->default(false);
            $table->unsignedInteger('order')->default(0);
            $table->json('tags')->nullable();
            $table->json('subtasks')->nullable();
            $table->json('attachments')->nullable();
            $table->boolean('demo_data')->default(false);
            $table->timestamps();
            $table->index(['project_id', 'status', 'order']);
            $table->index('due_date');
        });

        Schema::create('comments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->foreignId('task_id')->nullable()->constrained('tasks')->nullOnDelete();
            $table->foreignId('reply_to_id')->nullable()->constrained('comments')->nullOnDelete();
            $table->foreignId('author_id')->constrained('users')->restrictOnDelete();
            $table->text('content')->nullable();
            $table->json('attachments')->nullable();
            $table->boolean('demo_data')->default(false);
            $table->timestamps();
            $table->index(['project_id', 'created_at']);
            $table->index(['task_id', 'created_at']);
        });

        Schema::create('comment_mentions', function (Blueprint $table): void {
            $table->foreignId('comment_id')->constrained('comments')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->primary(['comment_id', 'user_id']);
        });

        Schema::create('requests', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('project_id')->constrained('projects')->cascadeOnDelete();
            $table->foreignId('task_id')->nullable()->constrained('tasks')->nullOnDelete();
            $table->foreignId('source_comment_id')->nullable()->constrained('comments')->nullOnDelete();
            $table->foreignId('created_by_id')->constrained('users')->restrictOnDelete();
            $table->string('title', 140);
            $table->text('description');
            $table->string('status', 32)->default('open');
            $table->string('priority', 32)->default('medium');
            $table->string('type', 40)->default('change_request');
            $table->json('attachments')->nullable();
            $table->boolean('demo_data')->default(false);
            $table->timestamps();
            $table->index(['project_id', 'created_at']);
            $table->index('status');
        });

        Schema::create('notifications', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('recipient_id')->constrained('users')->cascadeOnDelete();
            $table->string('title', 160);
            $table->text('message');
            $table->string('entity_type', 40);
            $table->string('entity_id', 40);
            $table->foreignId('project_id')->nullable()->constrained('projects')->nullOnDelete();
            $table->timestamp('read_at')->nullable();
            $table->json('metadata')->nullable();
            $table->boolean('demo_data')->default(false);
            $table->timestamps();
            $table->index(['recipient_id', 'created_at']);
            $table->index(['recipient_id', 'read_at']);
        });

        Schema::create('invites', function (Blueprint $table): void {
            $table->id();
            $table->string('email')->index();
            $table->string('role', 32);
            $table->string('token', 80)->unique();
            $table->foreignId('invited_by_id')->constrained('users')->restrictOnDelete();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamp('expires_at');
            $table->boolean('demo_data')->default(false);
            $table->timestamps();
        });

        Schema::create('activity_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action', 80);
            $table->text('message');
            $table->string('entity_type', 40);
            $table->string('entity_id', 40);
            $table->foreignId('project_id')->nullable()->constrained('projects')->nullOnDelete();
            $table->foreignId('task_id')->nullable()->constrained('tasks')->nullOnDelete();
            $table->json('metadata')->nullable();
            $table->boolean('demo_data')->default(false);
            $table->timestamps();
            $table->index(['project_id', 'created_at']);
            $table->index(['task_id', 'created_at']);
        });

        Schema::create('branding_settings', function (Blueprint $table): void {
            $table->id();
            $table->string('key')->unique()->default('branding');
            $table->string('brand_name', 80)->default('Bakhtech Solutions');
            $table->string('logo_url')->default('');
            $table->float('logo_size')->default(1);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('branding_settings');
        Schema::dropIfExists('activity_logs');
        Schema::dropIfExists('invites');
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('requests');
        Schema::dropIfExists('comment_mentions');
        Schema::dropIfExists('comments');
        Schema::dropIfExists('tasks');
        Schema::dropIfExists('project_clients');
        Schema::dropIfExists('project_team_members');
        Schema::dropIfExists('projects');
    }
};
