import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AuthShell } from '../components/layout/AuthShell';
import { api } from '../lib/api';
import { useAppStore } from '../store/useAppStore';

export function RegisterPage() {
  const user = useAppStore((state) => state.user);
  const setUser = useAppStore((state) => state.setUser);
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', password_confirmation: '' });
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await api.post('/auth/register', form);
      setUser(response.user);
      toast.success('Workspace created');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.payload?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Launch your workspace"
      title="Create a cold email workspace that feels operational from day one."
      subtitle="Provision the SaaS shell, mailbox controls, contact intelligence, automation, and reporting needed for structured outbound execution."
      footer={
        <p>
          Already have an account?{' '}
          <Link className="font-semibold text-blue-600 hover:text-blue-700" to="/login">
            Sign in
          </Link>
        </p>
      }
    >
      <h3 className="text-3xl font-semibold text-slate-950">Create account</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        Start with a secure operator identity. You can connect mailboxes and build campaigns after signup.
      </p>
      <form className="mt-8 grid gap-4" onSubmit={handleSubmit}>
        <label className="field-shell">
          <span className="field-label">Full name</span>
          <input className="field-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        </label>
        <label className="field-shell">
          <span className="field-label">Email address</span>
          <input className="field-input" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} type="email" required />
        </label>
        <label className="field-shell">
          <span className="field-label">Password</span>
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
          {loading ? 'Creating account...' : 'Create workspace'}
        </button>
      </form>
    </AuthShell>
  );
}
