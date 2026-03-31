<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ ($completed ?? false) ? 'Installation Complete' : 'Install TaskManager' }}</title>
    <style>
        :root {
            color-scheme: dark;
            --bg: #07111f;
            --panel: rgba(8, 19, 37, 0.92);
            --panel-2: rgba(11, 24, 46, 0.96);
            --border: rgba(147, 163, 184, 0.16);
            --text: #f8fafc;
            --muted: #94a3b8;
            --lime: #9fe01a;
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            min-height: 100vh;
            font-family: Inter, ui-sans-serif, system-ui, sans-serif;
            background:
                radial-gradient(circle at top left, rgba(93, 135, 255, 0.12), transparent 28%),
                linear-gradient(180deg, #0a1220 0%, #06101b 100%);
            color: var(--text);
        }
        .shell {
            max-width: 1120px;
            margin: 0 auto;
            padding: 32px 20px 56px;
        }
        .header { margin-bottom: 24px; }
        .eyebrow {
            margin: 0 0 8px;
            font-size: 12px;
            letter-spacing: 0.34em;
            color: var(--muted);
            text-transform: uppercase;
        }
        h1 {
            margin: 0;
            font-size: clamp(2rem, 4vw, 3.1rem);
            line-height: 1.02;
            font-family: Georgia, "Times New Roman", serif;
            font-weight: 600;
        }
        .subtle {
            margin: 12px 0 0;
            max-width: 700px;
            color: var(--muted);
            line-height: 1.65;
            font-size: 15px;
        }
        .layout {
            display: grid;
            gap: 24px;
            grid-template-columns: minmax(0, 1.7fr) minmax(280px, 0.9fr);
            align-items: start;
        }
        .card {
            border-radius: 28px;
            border: 1px solid var(--border);
            background: linear-gradient(180deg, rgba(11, 24, 46, 0.96), rgba(8, 18, 33, 0.98));
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.28);
        }
        .form-card { padding: 28px; }
        .side-card {
            padding: 24px;
            position: sticky;
            top: 24px;
        }
        .success-card { padding: 32px; }
        .section { margin-top: 26px; }
        .section:first-of-type { margin-top: 0; }
        .section-label {
            margin: 0 0 12px;
            font-size: 11px;
            letter-spacing: 0.28em;
            text-transform: uppercase;
            color: var(--muted);
        }
        .grid {
            display: grid;
            gap: 16px;
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .full { grid-column: 1 / -1; }
        label {
            display: block;
            margin-bottom: 8px;
            font-size: 13px;
            font-weight: 600;
            color: rgba(241, 245, 249, 0.96);
        }
        input {
            width: 100%;
            border-radius: 18px;
            border: 1px solid rgba(148, 163, 184, 0.18);
            background: rgba(15, 23, 42, 0.9);
            color: var(--text);
            padding: 14px 16px;
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        input:focus {
            border-color: rgba(159, 224, 26, 0.7);
            box-shadow: 0 0 0 3px rgba(159, 224, 26, 0.18);
        }
        .readonly {
            opacity: 0.78;
            cursor: not-allowed;
        }
        .meta {
            font-size: 13px;
            color: var(--muted);
            line-height: 1.65;
        }
        .requirements, .notes, .summary {
            display: grid;
            gap: 10px;
            margin-top: 16px;
        }
        .pill, .note, .summary-item {
            border-radius: 18px;
            padding: 12px 14px;
            border: 1px solid var(--border);
            background: rgba(10, 18, 33, 0.88);
            font-size: 13px;
            color: var(--muted);
        }
        .pill.ok {
            color: #d9f99d;
            border-color: rgba(159, 224, 26, 0.32);
            background: rgba(29, 78, 24, 0.18);
        }
        .pill.bad {
            color: #fecaca;
            border-color: rgba(248, 113, 113, 0.3);
            background: rgba(127, 29, 29, 0.18);
        }
        .summary-item strong {
            display: block;
            margin-bottom: 6px;
            font-size: 15px;
            color: var(--text);
        }
        .error-list {
            margin: 0 0 18px;
            padding: 14px 16px;
            border-radius: 20px;
            border: 1px solid rgba(248, 113, 113, 0.28);
            background: rgba(127, 29, 29, 0.16);
            color: #fee2e2;
        }
        .error-list ul {
            margin: 8px 0 0;
            padding-left: 18px;
        }
        .actions {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            margin-top: 28px;
        }
        .button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            border: 0;
            border-radius: 999px;
            padding: 14px 22px;
            font-size: 14px;
            font-weight: 700;
            color: #08111f;
            background: linear-gradient(180deg, #b7ff33 0%, #96db1a 100%);
            cursor: pointer;
            text-decoration: none;
        }
        @media (max-width: 920px) {
            .layout { grid-template-columns: 1fr; }
            .side-card { position: static; }
        }
        @media (max-width: 640px) {
            .shell { padding: 22px 14px 40px; }
            .form-card, .side-card, .success-card { padding: 22px; }
            .grid { grid-template-columns: 1fr; }
            .actions {
                flex-direction: column;
                align-items: stretch;
            }
            .button { width: 100%; }
        }
    </style>
</head>
<body>
    <div class="shell">
        <div class="header">
            <p class="eyebrow">Installer</p>
            <h1>{{ ($completed ?? false) ? 'TaskManager is ready.' : 'Set up TaskManager in one pass.' }}</h1>
            <p class="subtle">
                {{ ($completed ?? false)
                    ? 'The database tables, branding defaults, and your first Master Admin account are in place. You can sign in immediately.'
                    : 'Enter the database details for the MySQL database you already created on your server, then define the first Master Admin account. The installer will write the environment file, create the tables, and set up the system for you.' }}
            </p>
        </div>

        @if ($completed ?? false)
            <div class="card success-card">
                <p class="section-label">Installation Complete</p>
                <div class="summary">
                    <div class="summary-item">
                        <strong>Login email</strong>
                        <span class="meta">{{ $login['email'] }}</span>
                    </div>
                    <div class="summary-item">
                        <strong>Temporary password</strong>
                        <span class="meta">{{ $login['password'] }}</span>
                    </div>
                    <div class="summary-item">
                        <strong>Application URL</strong>
                        <span class="meta">{{ $appUrl }}</span>
                    </div>
                </div>
                <div class="actions">
                    <span class="meta">Next step: open the app and sign in with the credentials above.</span>
                    <a class="button" href="{{ url('/') }}">Open TaskManager</a>
                </div>
            </div>
        @else
            <div class="layout">
                <div class="card form-card">
                    @if ($errors->any())
                        <div class="error-list">
                            <strong>Installation could not complete.</strong>
                            <ul>
                                @foreach ($errors->all() as $error)
                                    <li>{{ $error }}</li>
                                @endforeach
                            </ul>
                        </div>
                    @endif

                    <form method="POST" action="{{ route('install.run') }}">
                        @csrf

                        <div class="section">
                            <p class="section-label">Application</p>
                            <div class="grid">
                                <div class="full">
                                    <label for="app_name">Workspace name</label>
                                    <input id="app_name" name="app_name" value="{{ $defaults['app_name'] }}" required>
                                </div>
                                <div class="full">
                                    <label for="app_url">Detected application URL</label>
                                    <input id="app_url" class="readonly" value="{{ $defaults['app_url'] }}" readonly>
                                </div>
                            </div>
                        </div>

                        <div class="section">
                            <p class="section-label">Database</p>
                            <div class="grid">
                                <div>
                                    <label for="db_host">Database host</label>
                                    <input id="db_host" name="db_host" value="{{ $defaults['db_host'] }}" required>
                                </div>
                                <div>
                                    <label for="db_port">Database port</label>
                                    <input id="db_port" name="db_port" type="number" value="{{ $defaults['db_port'] }}" required>
                                </div>
                                <div class="full">
                                    <label for="db_name">Database name</label>
                                    <input id="db_name" name="db_name" value="{{ $defaults['db_name'] }}" required>
                                </div>
                                <div>
                                    <label for="db_user">Database username</label>
                                    <input id="db_user" name="db_user" value="{{ $defaults['db_user'] }}" required>
                                </div>
                                <div>
                                    <label for="db_password">Database password</label>
                                    <input id="db_password" name="db_password" type="password" autocomplete="new-password">
                                </div>
                            </div>
                        </div>

                        <div class="section">
                            <p class="section-label">First Login</p>
                            <div class="grid">
                                <div class="full">
                                    <label for="admin_name">Master Admin name</label>
                                    <input id="admin_name" name="admin_name" value="{{ $defaults['admin_name'] }}" required>
                                </div>
                                <div class="full">
                                    <label for="admin_email">Master Admin email</label>
                                    <input id="admin_email" name="admin_email" type="email" value="{{ $defaults['admin_email'] }}" required>
                                </div>
                                <div>
                                    <label for="admin_password">Password</label>
                                    <input id="admin_password" name="admin_password" type="password" required autocomplete="new-password">
                                </div>
                                <div>
                                    <label for="admin_password_confirmation">Confirm password</label>
                                    <input id="admin_password_confirmation" name="admin_password_confirmation" type="password" required autocomplete="new-password">
                                </div>
                            </div>
                        </div>

                        <div class="section">
                            <p class="section-label">Email Notifications</p>
                            <div class="grid">
                                <div>
                                    <label for="mail_scheme">Mail encryption</label>
                                    <input id="mail_scheme" name="mail_scheme" value="{{ $defaults['mail_scheme'] }}" placeholder="tls">
                                </div>
                                <div>
                                    <label for="mail_port">SMTP port</label>
                                    <input id="mail_port" name="mail_port" type="number" value="{{ $defaults['mail_port'] }}" placeholder="587">
                                </div>
                                <div class="full">
                                    <label for="mail_host">SMTP host</label>
                                    <input id="mail_host" name="mail_host" value="{{ $defaults['mail_host'] }}" placeholder="mail.example.com">
                                </div>
                                <div>
                                    <label for="mail_user">SMTP username</label>
                                    <input id="mail_user" name="mail_user" value="{{ $defaults['mail_user'] }}" placeholder="notifications@example.com">
                                </div>
                                <div>
                                    <label for="mail_password">SMTP password</label>
                                    <input id="mail_password" name="mail_password" type="password" autocomplete="new-password">
                                </div>
                                <div>
                                    <label for="mail_from_address">From email</label>
                                    <input id="mail_from_address" name="mail_from_address" type="email" value="{{ $defaults['mail_from_address'] }}" placeholder="notifications@example.com">
                                </div>
                                <div>
                                    <label for="mail_from_name">From name</label>
                                    <input id="mail_from_name" name="mail_from_name" value="{{ $defaults['mail_from_name'] }}" placeholder="TaskManager">
                                </div>
                            </div>
                        </div>

                        <div class="actions">
                            <span class="meta">The database must already exist. SMTP details are optional during install, but required if you want real email notifications instead of logged mail.</span>
                            <button class="button" type="submit">Install TaskManager</button>
                        </div>
                    </form>
                </div>

                <div class="card side-card">
                    <p class="section-label">Server Check</p>
                    <div class="requirements">
                        @foreach ($requirements as $requirement)
                            <div class="pill {{ $requirement['passed'] ? 'ok' : 'bad' }}">
                                {{ $requirement['passed'] ? 'Ready:' : 'Fix first:' }} {{ $requirement['label'] }}
                            </div>
                        @endforeach
                    </div>

                    <div class="section">
                        <p class="section-label">What happens</p>
                        <div class="notes">
                            <div class="note">1. The installer verifies the database connection details you enter.</div>
                            <div class="note">2. It writes the Laravel environment file with your production database settings.</div>
                            <div class="note">3. It runs the database migrations and creates your first Master Admin account.</div>
                            <div class="note">4. If SMTP details are supplied, the app is ready to send branded invite and activity emails immediately.</div>
                            <div class="note">5. It locks the installer so the normal app opens on future visits.</div>
                        </div>
                    </div>
                </div>
            </div>
        @endif
    </div>
</body>
</html>
