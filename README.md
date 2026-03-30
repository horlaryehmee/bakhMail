# TaskManager Laravel App

This app is now the Laravel-only version of the workspace.

## Stack

- Laravel 13
- Inertia
- React
- Tailwind / Vite
- SQLite or MySQL

## Local run

1. Install PHP dependencies:

```bash
composer install
```

2. Install frontend dependencies:

```bash
npm install
```

3. Run the database setup:

```bash
php artisan migrate:fresh --seed
```

4. Start Laravel:

```bash
php artisan serve --host=127.0.0.1 --port=8090
```

5. Start Vite during development:

```bash
npm run dev
```

## Default login

- `admin@bakhtech.com`
- `BakhtechAdmin123!`

The database seeder also populates demo users, projects, tasks, requests, comments, notifications, and branding for the workspace.

## API

The frontend now talks to Laravel's own `/api` routes. It no longer depends on the old Node backend.
