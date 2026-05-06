import { MoonStar, SunMedium } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from '../store/useAppStore';

export function ThemeToggle({ compact = false }) {
  const theme = useAppStore((state) => state.theme);
  const toggleTheme = useAppStore((state) => state.toggleTheme);
  const dark = theme === 'dark';

  if (compact) {
    return (
      <motion.button
        type="button"
        onClick={toggleTheme}
        className="theme-icon-toggle"
        whileTap={{ scale: 0.94 }}
        whileHover={{ y: -1 }}
        aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={theme}
            className="theme-icon-toggle__glyph"
            initial={{ opacity: 0, rotate: -18, scale: 0.86 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 18, scale: 0.86 }}
            transition={{ duration: 0.18 }}
          >
            {dark ? <SunMedium size={16} /> : <MoonStar size={16} />}
          </motion.span>
        </AnimatePresence>
      </motion.button>
    );
  }

  return (
    <motion.button
      type="button"
      onClick={toggleTheme}
      className="theme-toggle"
      whileTap={{ scale: 0.97 }}
      aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`}
    >
      <span className="theme-toggle__state">
        <span className="theme-toggle__state-icon">
          {dark ? <MoonStar size={16} /> : <SunMedium size={16} />}
        </span>
        <span>{dark ? 'Dark mode' : 'Light mode'}</span>
      </span>
      <span className="theme-toggle__hint">{dark ? 'Switch to light' : 'Switch to dark'}</span>
    </motion.button>
  );
}
