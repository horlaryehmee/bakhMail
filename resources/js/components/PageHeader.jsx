import { motion } from 'framer-motion';

export function PageHeader({ eyebrow, title, description, actions = null, stats = [] }) {
  return (
    <motion.section
      className="page-header-panel"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="relative flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-3">
          {eyebrow ? (
            <motion.p className="eyebrow" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}>
              {eyebrow}
            </motion.p>
          ) : null}
          <div className="space-y-1.5">
            <motion.h1 className="page-title page-title--compact" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              {title}
            </motion.h1>
            {description ? (
              <motion.p className="page-copy page-copy--compact" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
                {description}
              </motion.p>
            ) : null}
          </div>
          {stats.length ? (
            <div className="flex flex-wrap gap-2">
              {stats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  className="inline-stat"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 + index * 0.03 }}
                >
                  <span className="inline-stat-label">{stat.label}</span>
                  <span className="inline-stat-value">{stat.value}</span>
                </motion.div>
              ))}
            </div>
          ) : null}
        </div>

        {actions ? (
          <motion.div
            className="flex flex-wrap items-center gap-3 xl:max-w-sm xl:justify-end"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {actions}
          </motion.div>
        ) : null}
      </div>
    </motion.section>
  );
}
