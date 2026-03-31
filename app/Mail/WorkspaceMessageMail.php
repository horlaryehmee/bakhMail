<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class WorkspaceMessageMail extends Mailable
{
    use Queueable;
    use SerializesModels;

    public function __construct(
        public array $branding,
        public array $messageData,
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: (string) ($this->messageData['subject'] ?? ($this->branding['brandName'] ?? 'Workspace update')),
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.workspace-message',
            text: 'emails.workspace-message-text',
        );
    }
}
