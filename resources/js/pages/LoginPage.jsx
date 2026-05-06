import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AuthShell } from '../components/layout/AuthShell';
import { api } from '../lib/api';
import { useAppStore } from '../store/useAppStore';

export function LoginPage() {
  const user = useAppStore((state) => state.user);
  const setUser = useAppStore((state) => state.setUser);
  const devMode = useAppStore((state) => state.devMode);
  const demoAccounts = useAppStore((state) => state.demoAccounts);
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', remember: true });
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  async function submitLogin(payload) {
    setLoading(true);

    try {
      const response = await api.post('/auth/login', payload);

      if (response.requires_two_factor) {
        toast('Two-factor challenge required');
        navigate('/2fa');
        return;
      }

      setUser(response.user);
      toast.success('Welcome back');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.payload?.message || 'Sign in failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await submitLogin(form);
  }

  async function loginWithDemo(account) {
    const payload = { email: account.email, password: account.password, remember: true };
    setForm(payload);
    await submitLogin(payload);
  }

  return (
    <AuthShell
      eyebrow="Secure workspace access"
      title="Outbound work should feel precise, not synthetic."
      subtitle="Sign in to manage mailbox operations, lead segments, campaign sequencing, and reply handling from a clearer control surface."
      footer={
        <p>
          New here?{' '}
          <Link className="font-semibold text-blue-600 hover:text-blue-700" to="/register">
            Create an account
          </Link>
        </p>
      }
    >
      <h3 className="text-3xl font-semibold text-slate-950">Sign in</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        Use your workspace credentials to access campaigns, analytics, reply sync, and mailbox controls.
      </p>

      <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
        <label className="field-shell">
          <span className="field-label">Email address</span>
          <input className="field-input" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} type="email" required />
        </label>
        <label className="field-shell">
          <span className="field-label">Password</span>
          <input className="field-input" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} type="password" required />
        </label>
        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <input
            checked={form.remember}
            onChange={(event) => setForm({ ...form, remember: event.target.checked })}
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          Keep this browser signed in
        </label>
        <button className="primary-button w-full justify-center" type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <Link className="mt-5 inline-flex text-sm font-semibold text-blue-600 hover:text-blue-700" to="/forgot-password">
        Forgot your password?
      </Link>

      {devMode && demoAccounts.length ? (
        <div className="mt-6 space-y-3 rounded-[24px] border border-dashed border-slate-300 bg-slate-50/80 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Development demo access</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Click a demo account to auto-fill and sign in immediately while the app is still in development mode.
            </p>
          </div>

          <div className="grid gap-3">
            {demoAccounts.map((account) => (
              <button
                key={account.email}
                type="button"
                className="surface-card-muted flex flex-col items-start gap-2 p-4 text-left transition hover:-translate-y-0.5"
                onClick={() => loginWithDemo(account)}
                disabled={loading}
              >
                <div className="flex w-full items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-slate-950">{account.label}</span>
                  <span className="status-badge status-badge--blue">Instant sign in</span>
                </div>
                <p className="text-sm text-slate-500">{account.email}</p>
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Passcode: {account.password}</p>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </AuthShell>
  );
}
