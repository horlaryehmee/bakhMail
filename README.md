# TaskManager V2

This folder is the Laravel + Inertia + React web-app version of the original TaskManager workspace. The UI now runs through Laravel while reusing the working React workspace and talking to the existing API/backend.

## Stack

- Laravel 13
- Inertia.js
- React 19
- Vite
- Tailwind CSS 4
- Existing TaskManager API for auth, projects, tasks, chat, requests, users, notifications, and branding

## Current Routes

- `/` -> full workspace app
- `/dashboard` -> same workspace app
- `/up` -> Laravel health route

## Run Locally

1. Start the existing backend API from the original TaskManager app so `VITE_API_URL` is reachable.
2. Open a terminal in `laravel-app`.
3. Install PHP dependencies:

```bash
composer install --no-dev
```

4. Install frontend dependencies:

```bash
npm install
```

5. Create the environment file if it does not exist:

```bash
cp .env.example .env
```

6. Generate the Laravel app key:

```bash
php artisan key:generate
```

7. Make sure `.env` points to the backend API:

```env
VITE_API_URL=http://localhost:4000/api
```

8. Build the frontend bundle:

```bash
npm run build
```

9. Start the Laravel server:

```bash
php artisan serve
```

Then open the URL shown by `php artisan serve`.

## Notes

- The Laravel app now serves the real workspace UI instead of the earlier static preview.
- The backend runtime is still the original TaskManager API. This keeps the current feature set working while the UI stack moves to Laravel + Inertia + React.
