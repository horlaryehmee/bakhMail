import { BarChart3 } from 'lucide-react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

const tones = {
  blue: {
    icon: 'bg-blue-100 text-blue-700',
    glow: 'metric-card--blue',
  },
  emerald: {
    icon: 'bg-emerald-100 text-emerald-700',
    glow: 'metric-card--emerald',
  },
  amber: {
    icon: 'bg-amber-100 text-amber-700',
    glow: 'metric-card--amber',
  },
  violet: {
    icon: 'bg-violet-100 text-violet-700',
    glow: 'metric-card--violet',
  },
  slate: {
    icon: 'bg-slate-100 text-slate-700',
    glow: 'metric-card--slate',
  },
};

export function MetricCard({ label, value, hint, icon: Icon = BarChart3, tone = 'blue' }) {
  const palette = tones[tone] || tones.blue;

  return (
    <motion.div
      whileHover={{ y: -5, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      className={clsx('surface-card metric-card', palette.glow)}
    >
      <div className="metric-card__shine" />
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="space-y-3">
          <p className="metric-label">{label}</p>
          <div className="space-y-2">
            <h3 className="metric-value">{value}</h3>
            {hint ? <span className="metric-hint">{hint}</span> : null}
          </div>
        </div>
        <motion.div
          className={clsx('metric-icon', palette.icon)}
          whileHover={{ rotate: -4, scale: 1.04 }}
          transition={{ type: 'spring', stiffness: 300, damping: 16 }}
        >
          <Icon size={18} />
        </motion.div>
      </div>
      <div className="metric-card__bars">
        <span />
        <span />
        <span />
      </div>
    </motion.div>
  );
}
