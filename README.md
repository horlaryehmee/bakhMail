# TaskManager Laravel App

Developed By Bakare Olayemi.

This app is now the Laravel-only version of the workspace.

## Stack

- Laravel 13
- Inertia
- React
- Tailwind / Vite
- SQLite or MySQL

## Production install

For cPanel or any normal PHP host:

1. Upload the Laravel app, but do not ship your local `.env` file. Let the installer create the server `.env`.
2. Point the domain or subdomain document root to `public/`.
3. Open `/install`.
4. Enter:
   - MySQL host, port, database name, username, and password
   - the first Master Admin name, email, and password
5. Submit the installer.

The installer will:

- write the `.env` file
- run the migrations
- create the first Master Admin account
- lock the installer so the app opens normally afterward

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
