import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  ChartSpline,
  Inbox,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ServerCog,
  Settings2,
  Shield,
  Users,
  X,
} from 'lucide-react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ThemeToggle } from '../ThemeToggle';
import { AppLogo } from '../AppLogo';
import { useAppStore } from '../../store/useAppStore';

const baseLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/contacts', label: 'Contacts', icon: Users },
  { to: '/quick-mail', label: 'Quick Mail', icon: Mail },
  { to: '/accounts', label: 'Accounts', icon: ServerCog },
  { to: '/campaigns', label: 'Campaigns', icon: Mail },
  { to: '/conversations', label: 'Replies', icon: Inbox },
  { to: '/analytics', label: 'Analytics', icon: ChartSpline },
  { to: '/settings', label: 'Settings', icon: Settings2 },
];

const mobileRailOrder = ['/dashboard', '/contacts', '/quick-mail', '/campaigns', '/analytics'];

function DesktopSidebar({ appName, user, notifications, today, links, onClose, onLogout }) {
  return (
    <div className="surface-card app-shell__sidebar flex h-full w-full flex-col overflow-hidden p-4">
      <div className="mb-5 flex items-center justify-between gap-3">
        <Link to="/dashboard" className="flex items-center gap-3">
          <AppLogo />
        </Link>
        {onClose ? (
          <button className="ghost-button xl:hidden" type="button" onClick={onClose}>
            <X size={18} />
          </button>
        ) : null}
      </div>

      <div className="sidebar-profile-card mb-4">
        <div className="sidebar-profile-card__meta">
          <div
            className="sidebar-profile-card__avatar"
            style={{ background: user?.avatar_color || 'linear-gradient(135deg, #3b82f6, #14b8a6)' }}
          >
            {user?.name?.slice(0, 2).toUpperCase() ?? 'BK'}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950">{user?.name || 'Guest user'}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{user?.role || 'standard'}</p>
          </div>
        </div>
        <ThemeToggle compact />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <nav className="space-y-2">
          {links.map(({ to, label, icon: Icon }, index) => (
            <motion.div
              key={to}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <NavLink to={to} className={({ isActive }) => clsx('nav-pill', isActive ? 'nav-pill--active' : 'nav-pill--idle')}>
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="nav-pill__icon">
                        <Icon size={18} />
                      </span>
                      <span className="font-medium">{label}</span>
                    </div>
                    <span className={clsx('nav-pill__dot', isActive ? 'opacity-100' : 'opacity-30')} />
                  </>
                )}
              </NavLink>
            </motion.div>
          ))}
        </nav>
      </div>

      <div className="sidebar-system-card mt-4">
        <p className="eyebrow !text-[0.58rem] !tracking-[0.22em]">Ops pulse</p>
        <h3 className="mt-3 text-base font-semibold text-slate-950">Delivery controls, automation, and reply sync in one loop</h3>
        <div className="mt-4 grid gap-2">
          <div className="sidebar-stat-row">
            <span>Notifications</span>
            <strong>{notifications.length}</strong>
          </div>
          <div className="sidebar-stat-row">
            <span>Today</span>
            <strong>{today}</strong>
          </div>
        </div>
        <button className="ghost-button mt-4 w-full justify-center" type="button" onClick={onLogout}>
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </div>
  );
}

export function AppShell({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    appName,
    user,
    notifications,
    sidebarOpen,
    setSidebarOpen,
    mobileRailCollapsed,
    toggleMobileRailCollapsed,
    logout,
  } = useAppStore((state) => state);
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const links = user?.role === 'admin' ? [...baseLinks, { to: '/admin', label: 'Admin', icon: Shield }] : baseLinks;
  const currentSection = links.find((link) => link.to === location.pathname)?.label || 'Workspace';
  const mobileRailLinks = links.filter((link) => mobileRailOrder.includes(link.to));

  async function handleLogout() {
    await logout();
    toast.success('Signed out');
    navigate('/login');
  }

  return (
    <div className="app-shell-root min-h-screen">
      <div className="app-ambient app-ambient--one" />
      <div className="app-ambient app-ambient--two" />

      <div className="mx-auto flex min-h-screen max-w-[1580px] gap-4 px-3 py-3 sm:px-4 lg:px-5">
        <AnimatePresence>
          {sidebarOpen ? (
            <motion.button
              type="button"
              className="fixed inset-0 z-40 bg-slate-950/42 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              aria-label="Close navigation"
            />
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {!mobileRailCollapsed ? (
            <motion.div
              className="mobile-side-rail lg:hidden"
              initial={{ x: -18, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -18, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <div className="surface-card mobile-side-rail__card">
                <button type="button" className="mobile-side-rail__button" onClick={() => setSidebarOpen(true)} aria-label="Expand side menu">
                  <Menu size={18} />
                </button>

                <nav className="mobile-side-rail__nav">
                  {mobileRailLinks.map(({ to, label, icon: Icon }) => (
                    <NavLink key={to} to={to} className="mobile-side-rail__link" aria-label={label}>
                      {({ isActive }) => (
                        <span className={clsx('mobile-side-rail__link-inner', isActive && 'mobile-side-rail__link-inner--active')}>
                          <Icon size={18} />
                        </span>
                      )}
                    </NavLink>
                  ))}
                </nav>

                <div className="mobile-side-rail__footer">
                  <button type="button" className="mobile-side-rail__button" onClick={toggleMobileRailCollapsed} aria-label="Collapse mobile side rail">
                    <PanelLeftClose size={18} />
                  </button>
                  <ThemeToggle compact />
                  <div className="mobile-side-rail__avatar" style={{ background: user?.avatar_color || '#dbeafe' }}>
                    {user?.name?.slice(0, 2).toUpperCase() ?? 'BK'}
                  </div>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {sidebarOpen ? (
            <motion.aside
              className={clsx('mobile-side-drawer lg:hidden', mobileRailCollapsed && 'mobile-side-drawer--flush')}
              initial={{ x: -22, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -22, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 220, damping: 26 }}
            >
              <DesktopSidebar
                appName={appName}
                user={user}
                notifications={notifications}
                today={today}
                links={links}
                onClose={() => setSidebarOpen(false)}
                onLogout={handleLogout}
              />
            </motion.aside>
          ) : null}
        </AnimatePresence>

        <motion.aside
          className="hidden lg:sticky lg:top-3 lg:flex lg:h-[calc(100vh-1.5rem)] lg:w-[300px]"
          initial={{ x: -24, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 26 }}
        >
          <DesktopSidebar
            appName={appName}
            user={user}
            notifications={notifications}
            today={today}
            links={links}
            onLogout={handleLogout}
          />
        </motion.aside>

        <div className={clsx('flex min-h-screen min-w-0 flex-1 flex-col gap-4 lg:pl-0', !mobileRailCollapsed && 'mobile-content-offset lg:!pl-0')}>
          <header className="surface-card app-topbar sticky top-3 z-30 px-4 py-3 sm:px-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex gap-2 lg:hidden">
                  <button className="ghost-button !px-3" type="button" onClick={toggleMobileRailCollapsed} aria-label={mobileRailCollapsed ? 'Show mobile side rail' : 'Hide mobile side rail'}>
                    {mobileRailCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
                  </button>
                  <button className="ghost-button !px-3" type="button" onClick={() => setSidebarOpen(true)} aria-label="Open side drawer">
                    <Menu size={16} />
                  </button>
                </div>
                <Link to="/dashboard" className="lg:hidden">
                  <AppLogo className="app-logo--compact" />
                </Link>
                <div className="hidden min-w-0 lg:block">
                  <p className="eyebrow !text-[0.58rem] !tracking-[0.22em]">Operations workspace</p>
                  <h2 className="truncate text-base font-semibold text-slate-950 sm:text-lg">{currentSection}</h2>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <div className="topbar-chip hidden md:flex">Last review: {today}</div>
                <div className="topbar-chip">
                  <Bell size={14} className="text-blue-600" />
                  <span>{notifications.length}</span>
                </div>
                <ThemeToggle compact />
                <div className="topbar-avatar" style={{ background: user?.avatar_color || '#dbeafe' }}>
                  {user?.name?.slice(0, 2).toUpperCase() ?? 'BK'}
                </div>
              </div>
            </div>
          </header>

          <AnimatePresence mode="wait">
            <motion.main
              key={location.pathname}
              className="pb-8"
              initial={{ opacity: 0, y: 18, scale: 0.992 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.992 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            >
              {children}
            </motion.main>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
