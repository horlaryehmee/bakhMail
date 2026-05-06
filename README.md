# BakhMail

BakhMail is a Laravel + React bulk cold email SaaS starter focused on professional outbound operations. It includes:

- Session auth, password reset, optional TOTP 2FA, and admin role gating
- Multi-account SMTP sending with encrypted mailbox credentials
- IMAP reply and bounce sync with threaded conversation history
- Contact CRM with CSV import/export, tags, groups, search, and segmentation
- Multi-step campaign builder with drag-and-drop sequence ordering
- Redis-backed queue jobs for scheduled sending, retries, reply sync, and warm-up automation
- Tracking for opens, clicks, replies, bounces, unsubscribes, and campaign-level analytics
- Admin controls, global settings, and user activity logging
- Admin-side Groq AI integration for OpenAI-compatible responses testing
- Glossy React dashboard UI with charts, modals, responsive tables, and mobile layout support

## Stack

- Backend: Laravel 13, MySQL, Redis queues, IMAP extension, Symfony Mailer
- Frontend: React 19, Vite, Tailwind CSS 4, Zustand, Framer Motion, Recharts, DnD Kit

## Prerequisites

- PHP 8.3+
- Composer
- MySQL 8+
- Redis
- Node.js 20+ / npm
- PHP `ext-imap`

## Setup

1. Install PHP dependencies:

```bash
composer install
```

2. Create environment config and generate the app key:

```bash
cp .env.example .env
php artisan key:generate
```

3. Update `.env` for MySQL, Redis, mail, and tracking domain values.
   Groq can be configured either from the admin settings UI or via `GROQ_API_KEY`.

4. Run migrations and seed the starter users:

```bash
php artisan migrate --seed
```

5. Install frontend dependencies and build assets:

```bash
npm install
npm run build
```

6. Run the application workers:

```bash
php artisan serve
php artisan queue:work redis --tries=3
php artisan schedule:work
```

For local frontend hot reload instead of a production build:

```bash
npm run dev
```

## Seeded Users

- Admin: `admin@bakhmail.test`
- Standard user: `hello@bakhmail.test`
- Password for both: `password`

## Core Routes

- SPA shell: `/`
- Auth: `/auth/*`
- API: `/api/*`
- Tracking pixel: `/track/open/{token}.gif`
- Click tracking: `/track/click/{token}`
- Unsubscribe: `/unsubscribe/{token}`

## Operations Notes

- Scheduled campaign launches are handled by `campaigns:dispatch`
- IMAP reply sync runs through `campaigns:sync-replies`
- Warm-up automation runs through `campaigns:warmup`
- The scheduler wires all three commands in `routes/console.php`
- Reply and bounce syncing currently uses the PHP IMAP extension, so OAuth token storage exists in the schema but provider-specific OAuth handshakes still need provider app credentials and final connection UX
- PDF export in the analytics UI uses browser print-to-PDF; CSV export is backed by a Laravel stream response

## Important Directories

- `app/Http/Controllers` - auth, public tracking, and JSON API controllers
- `app/Jobs` - queued send, warm-up, and analytics jobs
- `app/Services` - mail sending, IMAP sync, analytics, 2FA, placeholders, and import logic
- `app/Models` - mailbox, contact, campaign, thread, log, suppression, and settings models
- `database/migrations` - full schema for users, contacts, campaigns, logs, analytics, and settings
- `resources/js` - React SPA, dashboard pages, and shared UI components

## Project Documentation

Detailed project documentation and the running implementation status live in:

- `docs/PROJECT_DOCUMENTATION.md`

## Verification

Frontend dependencies were installed and the Vite production build completed successfully in this workspace with:

```bash
npm install
npm run build
```

Backend execution was not run in this environment because PHP and Composer were not available on the machine at build time.
