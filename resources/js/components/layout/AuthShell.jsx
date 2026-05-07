import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ThemeToggle } from '../ThemeToggle';
import { useAppStore } from '../../store/useAppStore';

export function AuthShell({ title, eyebrow, subtitle, children, footer }) {
  const appName = useAppStore((state) => state.appName);

  return (
    <div className="auth-shell-bg auth-shell-grid flex min-h-screen items-center justify-center px-4 py-6 sm:px-5 sm:py-8">
      <div className="app-ambient app-ambient--one" />
      <div className="app-ambient app-ambient--two" />

      <motion.div
        className="grid w-full max-w-6xl gap-4 xl:grid-cols-[1.05fr_0.95fr]"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 150, damping: 22 }}
      >
        <section className="hero-panel auth-shell__hero flex flex-col justify-between p-5 sm:p-7 lg:p-8">
          <div>
            <div className="flex items-center justify-between gap-3">
              <Link to="/login" className="inline-flex items-center gap-3">
                <div className="app-brand-mark">B</div>
                <div>
                  <p className="eyebrow !text-[0.58rem] !tracking-[0.22em]">Outbound platform</p>
                  <h1 className="text-xl font-semibold text-slate-950">{appName}</h1>
                </div>
              </Link>
              <ThemeToggle compact />
            </div>

            <div className="mt-8 space-y-3 sm:mt-10">
              <p className="eyebrow">{eyebrow}</p>
              <h2 className="page-title">{title}</h2>
              <p className="page-copy">{subtitle}</p>
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              ['Operational clarity', 'Navigation, hierarchy, and actions are tuned for daily sending work instead of decorative dashboards.'],
              ['Sharper rhythm', 'Stronger typography and restrained color create a more credible product surface.'],
              ['Responsive by default', 'The same system holds together cleanly across phones, tablets, and desktop review sessions.'],
            ].map(([headline, text], index) => (
              <motion.div
                key={headline}
                className="surface-card-muted p-4"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + index * 0.06 }}
              >
                <h3 className="text-base font-semibold text-slate-950">{headline}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <motion.section
          className="surface-card auth-panel px-5 py-6 sm:px-7 sm:py-8 lg:px-8"
          initial={{ opacity: 0, y: 20, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.08, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
          {footer ? <div className="mt-6 text-sm text-slate-500">{footer}</div> : null}
        </motion.section>
      </motion.div>
    </div>
  );
}
