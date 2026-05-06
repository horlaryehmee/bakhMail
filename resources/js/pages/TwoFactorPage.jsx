import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AuthShell } from '../components/layout/AuthShell';
import { api } from '../lib/api';
import { useAppStore } from '../store/useAppStore';

export function TwoFactorPage() {
  const navigate = useNavigate();
  const setUser = useAppStore((state) => state.setUser);
  const [form, setForm] = useState({ code: '', recovery_code: '' });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);

    try {
      const payload = form.code ? { code: form.code } : { recovery_code: form.recovery_code };
      const response = await api.post('/auth/2fa/challenge', payload);
      setUser(response.user);
      toast.success('Two-factor challenge passed');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.payload?.message || 'Challenge failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Two-factor authentication"
      title="Verify the second factor before loading workspace data."
      subtitle="Enter a code from your authenticator app or use a recovery code if the device is unavailable."
      footer={
        <p>
          Need to start over?{' '}
          <Link className="font-semibold text-blue-600 hover:text-blue-700" to="/login">
            Return to sign in
          </Link>
        </p>
      }
    >
      <h3 className="text-3xl font-semibold text-slate-950">Verify sign in</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        Complete the second step so mailbox data, campaigns, and analytics can be unlocked safely.
      </p>
      <form className="mt-8 grid gap-4" onSubmit={handleSubmit}>
        <label className="field-shell">
          <span className="field-label">Authenticator code</span>
          <input className="field-input" value={form.code} onChange={(event) => setForm({ code: event.target.value, recovery_code: '' })} />
        </label>
        <div className="text-center text-xs uppercase tracking-[0.3em] text-slate-400">or</div>
        <label className="field-shell">
          <span className="field-label">Recovery code</span>
          <input
            className="field-input"
            value={form.recovery_code}
            onChange={(event) => setForm({ recovery_code: event.target.value, code: '' })}
          />
        </label>
        <button className="primary-button w-full justify-center" type="submit" disabled={loading}>
          {loading ? 'Verifying...' : 'Verify'}
        </button>
      </form>
    </AuthShell>
  );
}
