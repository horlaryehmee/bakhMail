import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { ArrowRight, KeyRound, ShieldCheck } from 'lucide-react';
import { AppLogo } from '../components/AppLogo';
import { api } from '../lib/api';
import { useAppStore } from '../store/useAppStore';
import { ThemeToggle } from '../components/ThemeToggle';

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
    <div className="auth-shell-bg flex min-h-screen items-center justify-center px-4 py-8 sm:px-5">
      <div className="app-ambient app-ambient--one" />
      <div className="app-ambient app-ambient--two" />

      <motion.section
        className="signin-simple-card surface-card w-full max-w-[30rem] p-5 sm:p-7"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="signin-simple-topbar">
          <Link to="/login" className="signin-simple-brand">
            <AppLogo />
          </Link>
          <ThemeToggle compact />
        </div>

        <div className="signin-simple-intro">
          <p className="signin-simple-label">Two-factor authentication</p>
          <h1 className="signin-simple-title">Verify sign in</h1>
          <p className="signin-simple-copy">Enter your authenticator code or use a recovery code to continue.</p>
        </div>

        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          <label className="field-shell">
            <span className="field-label">Authenticator code</span>
            <div className="signin-simple-input">
              <ShieldCheck size={16} />
              <input className="field-input" value={form.code} onChange={(event) => setForm({ code: event.target.value, recovery_code: '' })} />
            </div>
          </label>

          <div className="text-center text-xs uppercase tracking-[0.24em] text-slate-400">or</div>

          <label className="field-shell">
            <span className="field-label">Recovery code</span>
            <div className="signin-simple-input">
              <KeyRound size={16} />
              <input
                className="field-input"
                value={form.recovery_code}
                onChange={(event) => setForm({ recovery_code: event.target.value, code: '' })}
              />
            </div>
          </label>

          <button className="primary-button w-full justify-center" type="submit" disabled={loading}>
            {loading ? 'Verifying...' : 'Verify'}
            {!loading ? <ArrowRight size={16} /> : null}
          </button>
        </form>

        <div className="signin-simple-footer">
          <span>Need to start over?</span>
          <Link className="signin-simple-link" to="/login">
            Return to sign in
          </Link>
        </div>
      </motion.section>
    </div>
  );
}
