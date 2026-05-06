import { motion } from 'framer-motion';

export function PageHeader({ eyebrow, title, description, actions = null, stats = [] }) {
  return (
    <motion.section
      className="hero-panel"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="hero-panel__mesh" />
      <div className="relative flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-4">
          {eyebrow ? (
            <motion.p className="eyebrow" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              {eyebrow}
            </motion.p>
          ) : null}
          <div className="space-y-2">
            <motion.h1 className="page-title" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
              {title}
            </motion.h1>
            {description ? (
              <motion.p className="page-copy" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
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
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 + index * 0.04 }}
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
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 }}
          >
            {actions}
          </motion.div>
        ) : null}
      </div>
    </motion.section>
  );
}
