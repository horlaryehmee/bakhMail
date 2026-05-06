# BakhMail Project Documentation

## Purpose

BakhMail is a Laravel + React outbound email operations platform. It is designed to help a user manage cold outreach from one system: authentication, contacts, mailbox accounts, campaign sequencing, reply monitoring, analytics, admin controls, and tracking.

This file is the repo-local working source of truth for:

- what the app currently does
- how the app is structured
- which parts are complete vs partial
- where future work should resume

When I continue work in this repository, this is the file I should update alongside meaningful product or architecture changes.

## Current Status

Last updated in this session: `2026-05-06`

Recent work completed in this workspace:

- redesigned the shared frontend visual system
- changed protected routing to use a persistent `AppShell` layout with nested routes
- fixed a runtime shell crash caused by a derived value being evaluated before `links` existed
- adjusted sidebar behavior so larger screens use a pinned sidebar earlier
- improved 2FA disable handling and surfaced validation errors in the UI

Known current expectation:

- the frontend is built and served through Laravel on `http://127.0.0.1:8000`
- seeded users are available
- SQLite is configured locally in `.env`

## Product Capabilities

### 1. Authentication and session management

Implemented:

- user registration
- email/password login
- logout
- forgot password flow
- password reset flow
- session-based authentication
- optional TOTP two-factor authentication
- recovery-code based 2FA fallback during challenge
- role-based separation between admin and standard users

Relevant backend:

- `app/Http/Controllers/Auth/AuthController.php`
- `app/Http/Controllers/Auth/TwoFactorController.php`
- `app/Services/TwoFactorService.php`

Relevant frontend:

- `resources/js/pages/LoginPage.jsx`
- `resources/js/pages/RegisterPage.jsx`
- `resources/js/pages/ForgotPasswordPage.jsx`
- `resources/js/pages/ResetPasswordPage.jsx`
- `resources/js/pages/TwoFactorPage.jsx`
- `resources/js/pages/SettingsPage.jsx`

Notes:

- 2FA setup, enable, and disable are exposed under `/api/2fa/*`
- disable requires the current password

### 2. Dashboard

Implemented:

- overview page for workspace activity
- counts for contacts, campaigns, email accounts, and unread notifications
- engagement summary from analytics service
- recent campaigns list
- recent operator activity list

Relevant backend:

- `app/Http/Controllers/Api/DashboardController.php`
- `app/Services/AnalyticsService.php`

Relevant frontend:

- `resources/js/pages/DashboardPage.jsx`
- `resources/js/components/charts/PerformanceChart.jsx`

### 3. Contact management

Implemented:

- create contacts
- update contacts
- delete contacts
- list and search contacts
- CSV import
- CSV export
- grouping and tagging support in filters
- segmentation support for campaigns

Relevant backend:

- `app/Http/Controllers/Api/ContactController.php`
- `app/Services/ContactImportService.php`
- `app/Models/Contact.php`
- `app/Models/ContactGroup.php`
- `app/Models/Tag.php`

Relevant frontend:

- `resources/js/pages/ContactsPage.jsx`

### 4. Email account management

Implemented:

- create mailbox/sender accounts
- update mailbox configuration
- delete accounts
- list accounts
- test account connectivity / sending route
- deliverability summary endpoint

Relevant backend:

- `app/Http/Controllers/Api/EmailAccountController.php`
- `app/Services/DynamicSmtpMailer.php`
- `app/Services/DeliverabilityService.php`
- `app/Models/EmailAccount.php`

Relevant frontend:

- `resources/js/pages/EmailAccountsPage.jsx`

Notes:

- credentials are intended to be stored encrypted
- warm-up automation exists in the job/command layer

### 5. Campaign builder and sequencing

Implemented:

- create campaigns
- edit campaigns
- delete campaigns
- preview rendered campaigns
- launch campaigns
- attach multiple sender accounts
- configure audience filters
- build multi-step sequences
- drag-and-drop step ordering
- HTML and plain text content support
- scheduled sends

Relevant backend:

- `app/Http/Controllers/Api/CampaignController.php`
- `app/Services/CampaignOrchestrator.php`
- `app/Services/PlaceholderService.php`
- `app/Models/Campaign.php`
- `app/Models/CampaignStep.php`
- `app/Models/CampaignRecipient.php`

Relevant frontend:

- `resources/js/pages/CampaignsPage.jsx`

Notes:

- launch behavior flows through the orchestrator
- preview rendering can accept a contact context

### 6. Conversation and reply management

Implemented:

- conversation list
- thread detail retrieval
- reply sync infrastructure
- threaded conversation history model

Relevant backend:

- `app/Http/Controllers/Api/ConversationController.php`
- `app/Services/ReplySyncService.php`
- `app/Models/ConversationThread.php`

Relevant frontend:

- `resources/js/pages/ConversationsPage.jsx`

Notes:

- IMAP is part of the intended reply sync path

### 7. Analytics and tracking

Implemented:

- analytics summary endpoint
- timeline reporting
- CSV analytics export
- open tracking
- click tracking
- unsubscribe tracking
- campaign-level event storage

Relevant backend:

- `app/Http/Controllers/Api/AnalyticsController.php`
- `app/Http/Controllers/PublicTrackingController.php`
- `app/Services/AnalyticsService.php`
- `app/Services/TrackingService.php`
- `app/Models/AnalyticsSnapshot.php`
- `app/Models/TrackingEvent.php`
- `app/Models/EmailLog.php`

Relevant frontend:

- `resources/js/pages/AnalyticsPage.jsx`

### 8. Notifications

Implemented:

- notification list
- unread count display
- mark notification as read

Relevant backend:

- `app/Http/Controllers/Api/NotificationController.php`

Relevant frontend:

- notification count is surfaced in `AppShell`

### 9. Admin controls

Implemented:

- admin-only summary endpoint
- user listing
- user update endpoint
- admin settings retrieval
- admin settings update

Relevant backend:

- `app/Http/Controllers/Api/AdminController.php`
- `app/Http/Middleware/EnsureRole.php`
- `app/Models/AppSetting.php`

Relevant frontend:

- `resources/js/pages/AdminPage.jsx`

### 10. Activity logging

Implemented:

- activity logging on important campaign actions
- recent activity display on dashboard

Relevant backend:

- `app/Services/ActivityLogger.php`
- `app/Models/ActivityLog.php`

## Frontend Structure

The frontend is a React SPA mounted inside Laravel.

Primary entry points:

- `resources/views/app.blade.php`
- `resources/js/app.jsx`

Routing:

- React Router is used
- protected routes now use a persistent shell layout via `Outlet`
- admin routes are separated from general authenticated routes

State:

- Zustand store in `resources/js/store/useAppStore.js`

Shared UI:

- `resources/js/components/layout/AppShell.jsx`
- `resources/js/components/layout/AuthShell.jsx`
- `resources/js/components/PageHeader.jsx`
- `resources/js/components/MetricCard.jsx`
- `resources/js/components/Modal.jsx`
- `resources/js/components/StatusBadge.jsx`
- `resources/js/components/ThemeToggle.jsx`

Styling:

- `resources/css/app.css`
- Tailwind CSS 4
- custom design tokens and component classes live in that CSS file

## Backend Structure

Framework:

- Laravel 13

High-level layers:

- controllers handle HTTP and JSON endpoints
- services hold business logic
- models represent core domain objects
- jobs and console commands handle asynchronous or scheduled work

Important directories:

- `app/Http/Controllers`
- `app/Services`
- `app/Models`
- `app/Jobs`
- `app/Console/Commands`
- `database/migrations`
- `routes`

## Key Services

- `AnalyticsService.php`: computes dashboard and reporting aggregates
- `CampaignOrchestrator.php`: campaign save, queue, and preview orchestration
- `ContactImportService.php`: CSV ingestion and contact import logic
- `DeliverabilityService.php`: deliverability checks / account status helpers
- `DynamicSmtpMailer.php`: runtime SMTP sending path
- `PlaceholderService.php`: contact/campaign token replacement
- `ReplySyncService.php`: reply and bounce synchronization behavior
- `TrackingService.php`: open/click/unsubscribe event handling
- `TwoFactorService.php`: TOTP secret generation and code verification
- `ActivityLogger.php`: writes user action logs

## Jobs and Scheduled Operations

Jobs:

- `SendCampaignStepJob.php`
- `SendWarmupEmailJob.php`
- `RecalculateCampaignAnalyticsJob.php`

Console commands:

- `DispatchScheduledCampaigns.php`
- `SyncReplies.php`
- `WarmupEmailAccounts.php`

Operational intent:

- campaign sending should run asynchronously
- reply sync should be scheduled
- warm-up should run on a recurring schedule

## Routes Overview

Auth routes:

- `/auth/register`
- `/auth/login`
- `/auth/logout`
- `/auth/forgot-password`
- `/auth/reset-password`
- `/auth/2fa/challenge`

Public tracking routes:

- `/track/open/{token}.gif`
- `/track/click/{token}`
- `/unsubscribe/{token}`

Authenticated API groups:

- `/api/dashboard`
- `/api/contacts/*`
- `/api/email-accounts/*`
- `/api/campaigns/*`
- `/api/conversations/*`
- `/api/analytics/*`
- `/api/notifications/*`
- `/api/2fa/*`
- `/api/admin/*` for admins only

SPA shell:

- catch-all handled by `SpaController`

## Local Development Setup

This workspace currently uses:

- PHP `8.3.x`
- Node-based frontend build through Vite
- SQLite in `.env`
- session auth
- local URL `http://127.0.0.1:8000`

Typical commands:

```bash
php artisan migrate --seed
php artisan serve --host=127.0.0.1 --port=8000
npm.cmd run build
```

Optional dev asset flow:

```bash
npm run dev
```

Seeded users:

- `admin@bakhmail.test` / `password`
- `hello@bakhmail.test` / `password`

## Database Notes

Configured local connection:

- `DB_CONNECTION=sqlite`
- `DB_DATABASE=database/database.sqlite`

Important persisted domains:

- users
- contacts
- groups
- tags
- email accounts
- campaigns
- campaign steps
- campaign recipients
- email logs
- tracking events
- conversation threads
- notifications
- activity logs
- analytics snapshots
- app settings

## Current UX / UI Notes

The current UI direction has been intentionally changed away from generic dashboard glassmorphism.

Current design goals:

- modern but not over-styled
- stronger editorial typography
- restrained color system
- consistent shared shell across protected pages
- better persistence of layout between route changes

Main design files:

- `resources/css/app.css`
- `resources/js/components/layout/AppShell.jsx`
- `resources/js/components/layout/AuthShell.jsx`

## Known Gaps and Follow-up Areas

These are the highest-signal places to resume future work:

1. Validate sidebar behavior across all responsive breakpoints in-browser, especially the small-screen drawer path.
2. Do a second UI pass on `Contacts`, `Analytics`, `Settings`, and `Admin` so they match the redesigned shell more completely.
3. Add stronger error presentation across the app instead of generic toast failures.
4. Verify full mailbox, send, and IMAP sync flows with realistic credentials.
5. Confirm queue and scheduler behavior end-to-end in a local environment that runs background workers continuously.
6. Expand project docs when backend behavior or UI flows materially change.

## Documentation Update Rule

This file should be updated when any of the following change:

- a user-facing feature is added, removed, or significantly altered
- routing or layout architecture changes
- data model assumptions change
- local setup instructions change
- a major bug fix changes the current known state

Minimum update expectation after future work:

- update `Current Status`
- update the relevant capability section
- add or remove a note in `Known Gaps and Follow-up Areas`

