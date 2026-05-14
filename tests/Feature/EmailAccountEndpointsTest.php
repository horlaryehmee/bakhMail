<?php

namespace Tests\Feature;

use App\Models\EmailAccount;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class EmailAccountEndpointsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        putenv('APP_INSTALLED=true');
        $_ENV['APP_INSTALLED'] = 'true';
        $_SERVER['APP_INSTALLED'] = 'true';
    }

    public function test_connect_endpoint_repairs_missing_email_accounts_table_and_creates_account(): void
    {
        $user = User::factory()->admin()->create();

        Schema::dropIfExists('email_accounts');

        $response = $this->actingAs($user)->postJson('/api/email-accounts/connect', [
            'name' => 'Primary Sender',
            'from_name' => 'Primary Sender',
            'email_address' => 'sender@example.com',
            'provider' => 'php_mail',
            'status' => 'active',
            'daily_limit' => 150,
            'hourly_limit' => 25,
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.email_address', 'sender@example.com')
            ->assertJsonPath('data.provider', 'php_mail');

        $this->assertDatabaseHas('email_accounts', [
            'user_id' => $user->id,
            'email_address' => 'sender@example.com',
            'provider' => 'php_mail',
        ]);
    }

    public function test_save_and_remove_endpoints_update_and_delete_owned_account(): void
    {
        $user = User::factory()->admin()->create();
        $account = EmailAccount::query()->create([
            'user_id' => $user->id,
            'name' => 'Initial Sender',
            'from_name' => 'Initial Sender',
            'email_address' => 'initial@example.com',
            'provider' => 'custom',
            'status' => 'active',
            'smtp_host' => 'smtp.example.com',
            'smtp_port' => 587,
            'smtp_encryption' => 'tls',
            'smtp_username' => 'initial@example.com',
            'smtp_password' => 'secret',
            'daily_limit' => 150,
            'hourly_limit' => 25,
            'health_score' => 100,
        ]);

        $this->actingAs($user)->postJson("/api/email-accounts/{$account->id}/save", [
            'name' => 'Updated Sender',
            'from_name' => 'Updated Sender',
            'email_address' => 'updated@example.com',
            'provider' => 'php_mail',
            'status' => 'active',
            'daily_limit' => 200,
            'hourly_limit' => 30,
        ])->assertOk()
            ->assertJsonPath('data.email_address', 'updated@example.com')
            ->assertJsonPath('data.provider', 'php_mail');

        $this->assertDatabaseHas('email_accounts', [
            'id' => $account->id,
            'email_address' => 'updated@example.com',
            'provider' => 'php_mail',
        ]);

        $this->actingAs($user)->postJson("/api/email-accounts/{$account->id}/remove")
            ->assertOk()
            ->assertJsonPath('status', 'deleted');

        $this->assertDatabaseMissing('email_accounts', [
            'id' => $account->id,
        ]);
    }

    public function test_sync_replies_endpoint_skips_unresolvable_imap_hosts_without_failing(): void
    {
        $user = User::factory()->admin()->create();
        $account = EmailAccount::query()->create([
            'user_id' => $user->id,
            'name' => 'Inbound Sender',
            'from_name' => 'Inbound Sender',
            'email_address' => 'inbound@example.com',
            'provider' => 'custom',
            'status' => 'active',
            'smtp_host' => 'smtp.example.com',
            'smtp_port' => 587,
            'smtp_encryption' => 'tls',
            'smtp_username' => 'inbound@example.com',
            'smtp_password' => 'secret',
            'imap_host' => 'https://imap.invalid.example/path',
            'imap_port' => 993,
            'imap_encryption' => 'ssl',
            'imap_username' => 'inbound@example.com',
            'imap_password' => 'secret',
        ]);

        $this->actingAs($user)->postJson("/api/email-accounts/{$account->id}/sync-replies")
            ->assertOk()
            ->assertJsonPath('status', 'synced')
            ->assertJsonPath('count', 0)
            ->assertJsonPath('imap.ready', false);
    }
}
