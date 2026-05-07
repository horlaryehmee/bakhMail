import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { ArrowRight, Mail, UserRound } from 'lucide-react';
import { api } from '../lib/api';
import { useAppStore } from '../store/useAppStore';
import { ThemeToggle } from '../components/ThemeToggle';

export function RegisterPage() {
  const appName = useAppStore((state) => state.appName);
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
          <p className="signin-simple-label">Workspace setup</p>
          <h1 className="signin-simple-title">Create account</h1>
          <p className="signin-simple-copy">Create your workspace account to start managing campaigns, contacts, and replies.</p>
        </div>

        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          <label className="field-shell">
            <span className="field-label">Full name</span>
            <div className="signin-simple-input">
              <UserRound size={16} />
              <input className="field-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            </div>
          </label>

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
            {!loading ? <ArrowRight size={16} /> : null}
          </button>
        </form>

        <div className="signin-simple-footer">
          <span>Already have an account?</span>
          <Link className="signin-simple-link" to="/login">
            Sign in
          </Link>
        </div>
      </motion.section>
    </div>
  );
}
