<?php

namespace Tests\Feature;

use App\Models\Contact;
use App\Models\ConversationThread;
use App\Models\EmailAccount;
use App\Models\EmailLog;
use App\Models\User;
use App\Services\DynamicSmtpMailer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use RuntimeException;
use Mockery;
use Tests\TestCase;

class ConversationRepliesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        putenv('APP_INSTALLED=true');
        $_ENV['APP_INSTALLED'] = 'true';
        $_SERVER['APP_INSTALLED'] = 'true';
    }

    public function test_reply_endpoint_returns_full_reply_body_in_thread_messages(): void
    {
        $user = User::factory()->admin()->create();
        $account = EmailAccount::query()->create([
            'user_id' => $user->id,
            'name' => 'Primary Sender',
            'from_name' => 'Primary Sender',
            'email_address' => 'sender@example.com',
            'provider' => 'custom',
            'status' => 'active',
            'smtp_host' => '127.0.0.1',
            'smtp_port' => 587,
            'smtp_encryption' => 'tls',
            'smtp_username' => 'sender@example.com',
            'smtp_password' => 'secret',
        ]);
        $contact = Contact::query()->create([
            'user_id' => $user->id,
            'email' => 'lead@example.com',
            'first_name' => 'Lead',
            'unsubscribe_token' => 'unsubscribe-token',
            'status' => 'active',
        ]);
        $thread = ConversationThread::query()->create([
            'user_id' => $user->id,
            'contact_id' => $contact->id,
            'email_account_id' => $account->id,
            'subject' => 'Intro thread',
            'status' => 'open',
            'last_message_at' => now(),
        ]);

        $mailer = Mockery::mock(DynamicSmtpMailer::class);
        $mailer->shouldReceive('send')
            ->once()
            ->andReturn(['message_id' => '<message-123@example.com>']);
        $this->app->instance(DynamicSmtpMailer::class, $mailer);

        $response = $this->actingAs($user)->postJson("/api/conversations/{$thread->id}/reply", [
            'subject' => 'Re: Intro thread',
            'body_html' => '<p>Hello there.</p><p>Can we talk tomorrow?</p>',
            'body_text' => "Hello there.\n\nCan we talk tomorrow?",
        ]);

        $response->assertOk()
            ->assertJsonPath('data.messages.0.body_text', "Hello there.\n\nCan we talk tomorrow?")
            ->assertJsonPath('data.messages.0.subject', 'Re: Intro thread');
    }

    public function test_reply_endpoint_returns_validation_message_when_send_fails(): void
    {
        $user = User::factory()->admin()->create();
        $account = EmailAccount::query()->create([
            'user_id' => $user->id,
            'name' => 'Primary Sender',
            'from_name' => 'Primary Sender',
            'email_address' => 'sender@example.com',
            'provider' => 'custom',
            'status' => 'active',
            'smtp_host' => '127.0.0.1',
            'smtp_port' => 587,
            'smtp_encryption' => 'tls',
            'smtp_username' => 'sender@example.com',
            'smtp_password' => 'secret',
        ]);
        $contact = Contact::query()->create([
            'user_id' => $user->id,
            'email' => 'lead@example.com',
            'first_name' => 'Lead',
            'unsubscribe_token' => 'unsubscribe-token',
            'status' => 'active',
        ]);
        $thread = ConversationThread::query()->create([
            'user_id' => $user->id,
            'contact_id' => $contact->id,
            'email_account_id' => $account->id,
            'subject' => 'Intro thread',
            'status' => 'open',
            'last_message_at' => now(),
        ]);

        $mailer = Mockery::mock(DynamicSmtpMailer::class);
        $mailer->shouldReceive('send')
            ->once()
            ->andThrow(new RuntimeException('SMTP host does not resolve. Update the mailbox SMTP host and try again.'));
        $this->app->instance(DynamicSmtpMailer::class, $mailer);

        $response = $this->actingAs($user)->postJson("/api/conversations/{$thread->id}/reply", [
            'subject' => 'Re: Intro thread',
            'body_html' => '<p>Hello there.</p><p>Can we talk tomorrow?</p>',
            'body_text' => "Hello there.\n\nCan we talk tomorrow?",
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['reply'])
            ->assertJsonPath('errors.reply.0', 'SMTP host does not resolve. Update the mailbox SMTP host and try again.');

        $this->assertSame('failed', EmailLog::query()->sole()->event_type);
    }
}
