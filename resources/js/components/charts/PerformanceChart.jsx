import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { motion } from 'framer-motion';
import { useAppStore } from '../../store/useAppStore';

export function PerformanceChart({ data = [] }) {
  const theme = useAppStore((state) => state.theme);
  const dark = theme === 'dark';

  return (
    <motion.section
      className="surface-card chart-panel p-4 sm:p-5"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <p className="eyebrow !text-[0.62rem] !tracking-[0.22em]">Performance timeline</p>
          <h3 className="text-xl font-semibold text-slate-950">Outreach volume and replies</h3>
          <p className="text-sm leading-6 text-slate-500">
            Motion stays subtle, but the chart stays live and readable in both themes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="status-badge status-badge--blue">Sent</span>
          <span className="status-badge status-badge--emerald">Replies</span>
        </div>
      </div>

      <div className="h-72 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="sentFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={dark ? 0.4 : 0.3} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="replyFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={dark ? 0.3 : 0.22} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={dark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(148, 163, 184, 0.18)'} vertical={false} />
            <XAxis tickLine={false} axisLine={false} dataKey="date" stroke={dark ? '#94a3b8' : '#64748b'} />
            <YAxis tickLine={false} axisLine={false} stroke={dark ? '#94a3b8' : '#64748b'} />
            <Tooltip
              contentStyle={{
                background: dark ? 'rgba(15, 23, 42, 0.96)' : 'rgba(255, 255, 255, 0.98)',
                border: dark ? '1px solid rgba(71, 85, 105, 0.55)' : '1px solid rgba(226, 232, 240, 1)',
                borderRadius: '18px',
                boxShadow: dark ? '0 20px 50px rgba(2, 6, 23, 0.35)' : '0 20px 40px rgba(15, 23, 42, 0.12)',
                color: dark ? '#e2e8f0' : '#0f172a',
              }}
            />
            <Area type="monotone" dataKey="sent" stroke="#3b82f6" fill="url(#sentFill)" strokeWidth={2.6} />
            <Area type="monotone" dataKey="replied" stroke="#10b981" fill="url(#replyFill)" strokeWidth={2.6} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.section>
  );
}
