import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AuthShell } from '../components/layout/AuthShell';
import { api } from '../lib/api';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const defaults = useMemo(
    () => ({
      token: params.get('token') || '',
      email: params.get('email') || '',
    }),
    [params],
  );
  const [form, setForm] = useState({ ...defaults, password: '', password_confirmation: '' });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);

    try {
      await api.post('/auth/reset-password', form);
      toast.success('Password reset complete');
      navigate('/login');
    } catch (error) {
      toast.error(error.payload?.message || 'Password reset failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Credential recovery"
      title="Set a new password and return to the workspace."
      subtitle="Confirm the reset token, choose a new password, and resume campaign operations."
      footer={
        <p>
          Return to{' '}
          <Link className="font-semibold text-blue-600 hover:text-blue-700" to="/login">
            sign in
          </Link>
        </p>
      }
    >
      <h3 className="text-3xl font-semibold text-slate-950">Reset password</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        Use the token from your reset email to create a new password for this account.
      </p>
      <form className="mt-8 grid gap-4" onSubmit={handleSubmit}>
        <label className="field-shell">
          <span className="field-label">Email address</span>
          <input className="field-input" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} type="email" required />
        </label>
        <label className="field-shell">
          <span className="field-label">Reset token</span>
          <input className="field-input" value={form.token} onChange={(event) => setForm({ ...form, token: event.target.value })} required />
        </label>
        <label className="field-shell">
          <span className="field-label">New password</span>
          <input className="field-input" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} type="password" required />
        </label>
        <label className="field-shell">
          <span className="field-label">Confirm password</span>
          <input
            className="field-input"
            value={form.password_confirmation}
            onChange={(event) => setForm({ ...form, password_confirmation: event.target.value })}
            type="password"
            required
          />
        </label>
        <button className="primary-button w-full justify-center" type="submit" disabled={loading}>
          {loading ? 'Saving...' : 'Save new password'}
        </button>
      </form>
    </AuthShell>
  );
}
