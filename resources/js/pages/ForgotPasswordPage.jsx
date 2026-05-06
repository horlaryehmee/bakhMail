import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AuthShell } from '../components/layout/AuthShell';
import { api } from '../lib/api';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);

    try {
      await api.post('/auth/forgot-password', { email });
      toast.success('Reset link requested');
    } catch (error) {
      toast.error(error.payload?.message || 'Could not request a reset link');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      eyebrow="Credential recovery"
      title="Reset access without breaking campaign operations."
      subtitle="Request a secure reset link and restore access to your workspace with minimal interruption."
      footer={
        <p>
          Back to{' '}
          <Link className="font-semibold text-blue-600 hover:text-blue-700" to="/login">
            sign in
          </Link>
        </p>
      }
    >
      <h3 className="text-3xl font-semibold text-slate-950">Forgot password</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        Enter the email address tied to this account and we will send a reset link.
      </p>
      <form className="mt-8 grid gap-4" onSubmit={handleSubmit}>
        <label className="field-shell">
          <span className="field-label">Email address</span>
          <input className="field-input" value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
        </label>
        <button className="primary-button w-full justify-center" type="submit" disabled={loading}>
          {loading ? 'Requesting...' : 'Send reset link'}
        </button>
      </form>
    </AuthShell>
  );
}
