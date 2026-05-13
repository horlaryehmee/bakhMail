import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Suspense, lazy, useEffect } from 'react';
import { AppShell } from './components/layout/AppShell';
import { useAppStore } from './store/useAppStore';
import '../css/app.css';

const DashboardPage = lazy(() => import('./Pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const ContactsPage = lazy(() => import('./Pages/ContactsPage').then((module) => ({ default: module.ContactsPage })));
const QuickMailPage = lazy(() => import('./Pages/QuickMailPage').then((module) => ({ default: module.QuickMailPage })));
const EmailAccountsPage = lazy(() => import('./Pages/EmailAccountsPage').then((module) => ({ default: module.EmailAccountsPage })));
const CampaignsPage = lazy(() => import('./Pages/CampaignsPage').then((module) => ({ default: module.CampaignsPage })));
const ConversationsPage = lazy(() => import('./Pages/ConversationsPage').then((module) => ({ default: module.ConversationsPage })));
const AnalyticsPage = lazy(() => import('./Pages/AnalyticsPage').then((module) => ({ default: module.AnalyticsPage })));
const SettingsPage = lazy(() => import('./Pages/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const AdminPage = lazy(() => import('./Pages/AdminPage').then((module) => ({ default: module.AdminPage })));
const LoginPage = lazy(() => import('./Pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const RegisterPage = lazy(() => import('./Pages/RegisterPage').then((module) => ({ default: module.RegisterPage })));
const ForgotPasswordPage = lazy(() => import('./Pages/ForgotPasswordPage').then((module) => ({ default: module.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('./Pages/ResetPasswordPage').then((module) => ({ default: module.ResetPasswordPage })));
const TwoFactorPage = lazy(() => import('./Pages/TwoFactorPage').then((module) => ({ default: module.TwoFactorPage })));

function ProtectedLayout() {
  const user = useAppStore((state) => state.user);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function AdminLayout() {
  const user = useAppStore((state) => state.user);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function SessionBootstrap() {
  const user = useAppStore((state) => state.user);
  const theme = useAppStore((state) => state.theme);
  const fetchNotifications = useAppStore((state) => state.fetchNotifications);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    if (user) {
      fetchNotifications().catch(() => {});
    }
  }, [user, fetchNotifications]);

  return null;
}

function App() {
  const user = useAppStore((state) => state.user);
  const theme = useAppStore((state) => state.theme);

  return (
    <>
      <SessionBootstrap />
      <Toaster
        position="top-right"
        toastOptions={{
          className: `toast-shell ${theme === 'dark' ? 'toast-shell--dark' : 'toast-shell--light'}`,
        }}
      />
      <Routes>
        <Route path="/" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/2fa" element={<TwoFactorPage />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/quick-mail" element={<QuickMailPage />} />
          <Route path="/accounts" element={<EmailAccountsPage />} />
          <Route path="/campaigns" element={<CampaignsPage />} />
          <Route path="/conversations" element={<ConversationsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminPage />} />
        </Route>
        <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
      </Routes>
    </>
  );
}

createRoot(document.getElementById('app')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
