import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, ChevronDown, Mail, Radar } from 'lucide-react';
import { api } from '../lib/api';
import { useAppStore } from '../store/useAppStore';
import { ThemeToggle } from '../components/ThemeToggle';

export function LoginPage() {
  const appName = useAppStore((state) => state.appName);
  const user = useAppStore((state) => state.user);
  const setUser = useAppStore((state) => state.setUser);
  const devMode = useAppStore((state) => state.devMode);
  const demoAccounts = useAppStore((state) => state.demoAccounts);
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', remember: true });
  const [loading, setLoading] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

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
            <span className="app-brand-mark">B</span>
            <span>
              <span className="signin-simple-label">Platform</span>
              <span className="signin-simple-name">{appName}</span>
            </span>
          </Link>
          <ThemeToggle compact />
        </div>

        <div className="signin-simple-intro">
          <p className="signin-simple-label">Workspace entry</p>
          <h1 className="signin-simple-title">Sign in</h1>
          <p className="signin-simple-copy">Access your account to manage campaigns, contacts, and replies.</p>
        </div>

        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          <label className="field-shell">
            <span className="field-label">Email address</span>
            <div className="signin-simple-input">
              <Mail size={16} />
              <input className="field-input" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} type="email" required />
            </div>
          </label>

          <label className="field-shell">
            <span className="field-label">Password</span>
            <input className="field-input" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} type="password" required />
          </label>

          <div className="signin-simple-meta">
            <label className="signin-simple-check">
              <input checked={form.remember} onChange={(event) => setForm({ ...form, remember: event.target.checked })} type="checkbox" />
              <span>Keep me signed in</span>
            </label>

            <Link className="signin-simple-link" to="/forgot-password">
              Forgot password?
            </Link>
          </div>

          <button className="primary-button w-full justify-center" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Enter workspace'}
            {!loading ? <ArrowRight size={16} /> : null}
          </button>
        </form>

        <button type="button" className="signin-simple-about" onClick={() => setAboutOpen((value) => !value)}>
          <span className="signin-simple-about__label">
            <Radar size={15} />
            About platform
          </span>
          <ChevronDown size={16} className={aboutOpen ? 'signin-simple-about__icon is-open' : 'signin-simple-about__icon'} />
        </button>

        <AnimatePresence initial={false}>
          {aboutOpen ? (
            <motion.div
              className="signin-simple-summary"
              initial={{ opacity: 0, y: -6, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -6, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <p className="signin-simple-summary__headline">BakhMail helps teams manage cold email outreach from one workspace.</p>
              <div className="signin-simple-summary__grid">
                {[
                  ['Contacts', 'Organize leads and segments.'],
                  ['Campaigns', 'Build and manage sending sequences.'],
                  ['Replies', 'Track conversations and responses.'],
                  ['Analytics', 'Review performance in one place.'],
                ].map(([title, copy]) => (
                  <div key={title} className="signin-simple-summary__item">
                    <strong>{title}</strong>
                    <p>{copy}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {devMode && demoAccounts.length ? (
          <div className="signin-simple-demo">
            <div className="signin-simple-demo__header">
              <p className="signin-simple-label">Demo access</p>
              <span className="status-badge status-badge--blue">Local only</span>
            </div>
            <div className="signin-simple-demo__list">
              {demoAccounts.map((account) => (
                <button key={account.email} type="button" className="signin-simple-demo__item" onClick={() => loginWithDemo(account)} disabled={loading}>
                  <div>
                    <strong>{account.label}</strong>
                    <p>{account.email}</p>
                  </div>
                  <span>{account.password}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="signin-simple-footer">
          <span>New here?</span>
          <Link className="signin-simple-link" to="/register">
            Create an account
          </Link>
        </div>
      </motion.section>
    </div>
  );
}
