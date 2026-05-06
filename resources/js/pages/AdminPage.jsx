import { useEffect, useState } from 'react';
import { Shield, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { MetricCard } from '../components/MetricCard';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { api } from '../lib/api';

export function AdminPage() {
  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState({});

  async function load() {
    const [summaryResponse, usersResponse, settingsResponse] = await Promise.all([
      api.get('/api/admin/summary'),
      api.get('/api/admin/users'),
      api.get('/api/admin/settings'),
    ]);

    setSummary(summaryResponse);
    setUsers(usersResponse.data || []);
    setSettings(settingsResponse.data || {});
  }

  useEffect(() => {
    load().catch(() => toast.error('Could not load admin data'));
  }, []);

  async function updateUserRole(userId, role) {
    try {
      await api.put(`/api/admin/users/${userId}`, { role });
      toast.success('User updated');
      load();
    } catch {
      toast.error('Could not update user');
    }
  }

  async function saveSettings() {
    try {
      await api.put('/api/admin/settings', { settings });
      toast.success('Settings saved');
    } catch {
      toast.error('Could not save settings');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin controls"
        title="Manage users, workspace settings, and overall system usage."
        description="This view centralizes operator access, high-level usage metrics, and global controls that affect tracking, warm-up defaults, and suppression behavior."
        stats={[
          { label: 'Users', value: summary?.users ?? 0 },
          { label: 'Campaigns', value: summary?.campaigns ?? 0 },
          { label: 'Contacts', value: summary?.contacts ?? 0 },
        ]}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Users" value={summary?.users ?? 0} hint="Workspace operators" icon={Users} tone="blue" />
        <MetricCard label="Campaigns" value={summary?.campaigns ?? 0} hint="All workspaces" tone="violet" />
        <MetricCard label="Contacts" value={summary?.contacts ?? 0} hint="Stored records" tone="emerald" />
        <MetricCard label="Sent emails" value={summary?.emails_sent ?? 0} hint="Tracked volume" icon={Shield} tone="amber" />
      </section>

      <section className="surface-card table-shell">
        <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
          <p className="eyebrow !text-[0.64rem] !tracking-[0.24em]">User management</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Workspace operators</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[980px] text-left">
            <thead>
              <tr>
                <th>Operator</th>
                <th>Role</th>
                <th>Usage</th>
                <th>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {users.length ? (
                users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="font-semibold text-slate-950">{user.name}</div>
                      <div className="mt-1 text-sm text-slate-500">{user.email}</div>
                    </td>
                    <td>
                      <div className="flex items-center gap-3">
                        <StatusBadge status={user.role} tone={user.role === 'admin' ? 'blue' : 'slate'} />
                        <select className="field-input max-w-40 rounded-full border border-slate-200 bg-white px-3 py-2" value={user.role} onChange={(event) => updateUserRole(user.id, event.target.value)}>
                          <option value="standard">standard</option>
                          <option value="admin">admin</option>
                        </select>
                      </div>
                    </td>
                    <td className="text-sm text-slate-600">
                      {user.contacts_count} contacts / {user.campaigns_count} campaigns / {user.email_accounts_count} accounts
                    </td>
                    <td className="text-sm text-slate-600">{user.last_seen_at ? new Date(user.last_seen_at).toLocaleString() : 'Never'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4}>
                    <div className="empty-panel m-4 p-6 text-center text-sm">No operators found.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="surface-card p-5 sm:p-6">
        <p className="eyebrow !text-[0.64rem] !tracking-[0.24em]">Global settings</p>
        <h3 className="mt-2 text-2xl font-semibold text-slate-950">Workspace-level controls</h3>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {['tracking_base_url', 'warmup_default_recipient', 'suppression_retention_days'].map((key) => (
            <label key={key} className="field-shell">
              <span className="field-label">{key}</span>
              <input className="field-input" value={settings[key] ?? ''} onChange={(event) => setSettings({ ...settings, [key]: event.target.value })} />
            </label>
          ))}
        </div>
        <button className="primary-button mt-5" type="button" onClick={saveSettings}>
          Save settings
        </button>
      </section>
    </div>
  );
}
