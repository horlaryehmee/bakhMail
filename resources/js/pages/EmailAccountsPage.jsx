import { useEffect, useMemo, useState } from 'react';
import { Inbox, Plus, Radar, RefreshCcw, Send, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { api } from '../lib/api';

function createEmptyAccount() {
  return {
    name: '',
    from_name: '',
    email_address: '',
    reply_to_address: '',
    provider: 'custom',
    status: 'active',
    smtp_host: '',
    smtp_port: 587,
    smtp_encryption: 'tls',
    smtp_username: '',
    smtp_password: '',
    imap_host: '',
    imap_port: 993,
    imap_encryption: 'ssl',
    imap_username: '',
    imap_password: '',
    warmup_enabled: false,
    warmup_target_email: '',
    daily_limit: 150,
    hourly_limit: 25,
  };
}

export function EmailAccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [checks, setChecks] = useState([]);
  const [form, setForm] = useState(createEmptyAccount());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  async function load() {
    const [accountResponse, deliverabilityResponse] = await Promise.all([
      api.get('/api/email-accounts'),
      api.get('/api/email-accounts/deliverability'),
    ]);

    setAccounts(accountResponse.data || []);
    setChecks(deliverabilityResponse.data || []);
  }

  useEffect(() => {
    load().catch((error) => toast.error(error.payload?.message || error.message || 'Could not load mailbox accounts'));
  }, []);

  const warmupEnabled = useMemo(() => accounts.filter((account) => account.warmup_enabled).length, [accounts]);
  const averageHealth = useMemo(() => {
    if (!accounts.length) return 0;
    return Math.round(accounts.reduce((total, account) => total + (account.health_score || 0), 0) / accounts.length);
  }, [accounts]);

  function openNewModal() {
    setEditingId(null);
    setForm(createEmptyAccount());
    setModalOpen(true);
  }

  async function saveAccount(event) {
    event.preventDefault();

    try {
      if (editingId) {
        await api.post(`/api/email-accounts/${editingId}/save`, form);
        toast.success('Mailbox updated');
      } else {
        await api.post('/api/email-accounts/connect', form);
        toast.success('Mailbox connected');
      }

      setModalOpen(false);
      setForm(createEmptyAccount());
      setEditingId(null);
      load();
    } catch (error) {
      const firstError = Object.values(error.payload?.errors || {})?.[0]?.[0];
      toast.error(firstError || error.payload?.message || error.message || 'Could not save mailbox');
    }
  }

  function startEdit(account) {
    setEditingId(account.id);
    setForm({ ...createEmptyAccount(), ...account, smtp_password: '', imap_password: '' });
    setModalOpen(true);
  }

  async function sendTest(accountId) {
    try {
      await api.post(`/api/email-accounts/${accountId}/test-connection`, {});
      toast.success('Test email sent');
    } catch (error) {
      const firstError = Object.values(error.payload?.errors || {})?.[0]?.[0];
      toast.error(firstError || error.payload?.message || error.message || 'SMTP test failed');
    }
  }

  async function testImap(accountId) {
    try {
      const response = await api.post(`/api/email-accounts/${accountId}/test-imap`, {});
      toast.success(response.data?.message || 'IMAP test completed');
      load();
    } catch (error) {
      toast.error(error.payload?.message || error.message || 'IMAP test failed');
    }
  }

  async function syncReplies(accountId) {
    try {
      const response = await api.post(`/api/email-accounts/${accountId}/sync-replies`, {});
      toast.success(`Reply sync completed: ${response.count || 0} message(s)`);
      load();
    } catch (error) {
      toast.error(error.payload?.message || error.message || 'Reply sync failed');
    }
  }

  async function removeAccount(accountId) {
    try {
      await api.post(`/api/email-accounts/${accountId}/remove`, {});
      toast.success('Mailbox removed');
      load();
    } catch (error) {
      toast.error(error.payload?.message || error.message || 'Could not remove mailbox');
    }
  }

  return (
    <div className="space-y-6">
      <section className="surface-card email-accounts-hero">
        <div className="email-accounts-hero__body">
          <div className="space-y-2">
            <p className="eyebrow !mb-0">Email infrastructure</p>
            <h1 className="email-accounts-hero__title">Sender accounts</h1>
            <p className="email-accounts-hero__copy">
              Connect SMTP and IMAP mailboxes, run health checks, and manage warm-up from one screen.
            </p>
          </div>

          <div className="email-accounts-hero__actions">
            <button className="primary-button" type="button" onClick={openNewModal}>
              <Plus size={16} />
              <span>Connect account</span>
            </button>
          </div>
        </div>

        <div className="email-accounts-hero__stats">
          <div className="email-accounts-hero__stat">
            <span className="email-accounts-hero__stat-label">Accounts</span>
            <strong className="email-accounts-hero__stat-value">{accounts.length}</strong>
          </div>
          <div className="email-accounts-hero__stat">
            <span className="email-accounts-hero__stat-label">Warm-up on</span>
            <strong className="email-accounts-hero__stat-value">{warmupEnabled}</strong>
          </div>
          <div className="email-accounts-hero__stat">
            <span className="email-accounts-hero__stat-label">Avg health</span>
            <strong className="email-accounts-hero__stat-value">{averageHealth}/100</strong>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="surface-card table-shell">
          <div className="overflow-x-auto">
            <table className="data-table min-w-[760px] text-left">
              <thead>
                <tr>
                  <th>Mailbox</th>
                  <th>Provider</th>
                  <th>Health</th>
                  <th>SMTP</th>
                  <th>IMAP</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.length ? (
                  accounts.map((account) => (
                    <tr key={account.id}>
                      <td>
                        <div className="font-semibold text-slate-950">{account.email_address}</div>
                        <div className="mt-1 text-sm text-slate-500">{account.name || account.from_name || 'No display name'}</div>
                      </td>
                      <td>
                        <div className="font-medium text-slate-700">{account.provider}</div>
                        <div className="mt-1 text-sm text-slate-500">{account.smtp_configured ? 'SMTP ready' : 'SMTP incomplete'}</div>
                      </td>
                      <td>
                        <StatusBadge status={`${account.health_score || 0} health`} tone={account.health_score >= 80 ? 'emerald' : account.health_score >= 60 ? 'amber' : 'rose'} />
                      </td>
                      <td>
                        <div className="space-y-2">
                          <StatusBadge
                            status={account.smtp?.ready ? 'ready' : 'issue'}
                            tone={account.smtp?.ready ? 'emerald' : 'rose'}
                          />
                          <div className="max-w-[240px] text-sm text-slate-500">
                            {account.smtp?.message || (account.smtp_configured ? 'SMTP configured' : 'SMTP incomplete')}
                          </div>
                          {account.smtp?.effective_host ? (
                            <div className="text-xs text-slate-400">
                              Active host: {account.smtp.effective_host}
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div className="space-y-2">
                          <StatusBadge
                            status={account.imap?.ready ? 'ready' : 'issue'}
                            tone={account.imap?.ready ? 'emerald' : 'rose'}
                          />
                          <div className="max-w-[240px] text-sm text-slate-500">
                            {account.imap?.message || (account.imap_configured ? 'IMAP configured' : 'IMAP incomplete')}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex justify-end gap-2">
                          <button className="ghost-button" type="button" onClick={() => sendTest(account.id)}>
                            <Send size={16} />
                            SMTP
                          </button>
                          <button className="ghost-button" type="button" onClick={() => testImap(account.id)}>
                            <Inbox size={16} />
                            IMAP
                          </button>
                          <button className="ghost-button" type="button" onClick={() => syncReplies(account.id)}>
                            <RefreshCcw size={16} />
                            Sync
                          </button>
                          <button className="ghost-button" type="button" onClick={() => startEdit(account)}>
                            Edit
                          </button>
                          <button className="ghost-button" type="button" onClick={() => removeAccount(account.id)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>
                      <div className="empty-panel m-4 p-6 text-center text-sm">
                        No sender accounts are connected yet.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="surface-card p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
              <Radar size={18} />
            </div>
            <div>
              <p className="eyebrow !text-[0.64rem] !tracking-[0.24em]">Deliverability</p>
              <h3 className="text-xl font-semibold text-slate-950">SPF, DKIM, and DMARC</h3>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {checks.length ? (
              checks.map((check) => (
                <div key={check.domain} className="surface-card-muted p-4">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-slate-950">{check.domain}</strong>
                    <span className="status-badge status-badge--slate">{check.score}/99</span>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm text-slate-600">
                    <div>SPF: {check.spf.status}</div>
                      <div>DKIM: {check.dkim.status}</div>
                      <div>DMARC: {check.dmarc.status}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-panel p-6 text-sm">No deliverability checks are available yet.</div>
            )}
          </div>

          <div className="mt-6 surface-card-muted p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                <ShieldCheck size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-950">Mailbox safety checklist</p>
                <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-500">
                  <li>Verify SPF, DKIM, and DMARC before increasing volume.</li>
                  <li>Keep bounce handling and unsubscribe suppression active.</li>
                  <li>Use warm-up on new accounts before attaching them to rotation pools.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </div>

      <Modal
        open={modalOpen}
        title={editingId ? 'Edit mailbox account' : 'Connect mailbox account'}
        onClose={() => setModalOpen(false)}
        width="max-w-6xl"
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            <button className="ghost-button" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button className="primary-button" type="submit" form="account-form">
              {editingId ? 'Save changes' : 'Connect account'}
            </button>
          </div>
        }
      >
        <form id="account-form" className="grid gap-6 xl:grid-cols-2" onSubmit={saveAccount}>
          <div className="space-y-4">
            <div className="surface-card-muted p-5">
              <p className="eyebrow !text-[0.64rem] !tracking-[0.24em]">Identity</p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-950">Mailbox profile</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Configure the visible sender identity and reply routing used for campaign sends.
              </p>
            </div>

            {[
              ['name', 'Display name', 'text'],
              ['from_name', 'From name', 'text'],
              ['email_address', 'Email address', 'email'],
              ['reply_to_address', 'Reply-to address', 'email'],
            ].map(([key, label, type]) => (
              <label key={key} className="field-shell">
                <span className="field-label">{label}</span>
                <input className="field-input" type={type} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
              </label>
            ))}

            <label className="field-shell">
              <span className="field-label">Provider</span>
              <select className="field-input" value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value })}>
                <option value="custom">Custom SMTP/IMAP</option>
                <option value="gmail">Gmail</option>
                <option value="outlook">Outlook</option>
                <option value="php_mail">PHP Mail</option>
              </select>
            </label>
          </div>

          <div className="space-y-4">
            <div className="surface-card-muted p-5">
              <p className="eyebrow !text-[0.64rem] !tracking-[0.24em]">Transport and limits</p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-950">SMTP, IMAP, and warm-up</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Add transport credentials securely, then define limits that keep the account within safe volume.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {[
                ['smtp_host', 'SMTP host', 'text'],
                ['smtp_port', 'SMTP port', 'number'],
                ['smtp_username', 'SMTP username', 'text'],
                ['smtp_password', 'SMTP password', 'password'],
                ['imap_host', 'IMAP host', 'text'],
                ['imap_port', 'IMAP port', 'number'],
                ['imap_username', 'IMAP username', 'text'],
                ['imap_password', 'IMAP password', 'password'],
              ].map(([key, label, type]) => (
                <label key={key} className="field-shell">
                  <span className="field-label">{label}</span>
                  <input className="field-input" type={type} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
                </label>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="field-shell">
                <span className="field-label">SMTP encryption</span>
                <select className="field-input" value={form.smtp_encryption} onChange={(event) => setForm({ ...form, smtp_encryption: event.target.value })}>
                  <option value="tls">TLS</option>
                  <option value="ssl">SSL</option>
                  <option value="">None</option>
                </select>
              </label>
              <label className="field-shell">
                <span className="field-label">IMAP encryption</span>
                <select className="field-input" value={form.imap_encryption} onChange={(event) => setForm({ ...form, imap_encryption: event.target.value })}>
                  <option value="ssl">SSL</option>
                  <option value="tls">TLS</option>
                  <option value="">None</option>
                </select>
              </label>
              <label className="field-shell">
                <span className="field-label">Warm-up target</span>
                <input className="field-input" value={form.warmup_target_email} onChange={(event) => setForm({ ...form, warmup_target_email: event.target.value })} />
              </label>
              <label className="field-shell">
                <span className="field-label">Daily limit</span>
                <input className="field-input" type="number" value={form.daily_limit} onChange={(event) => setForm({ ...form, daily_limit: Number(event.target.value) })} />
              </label>
              <label className="field-shell">
                <span className="field-label">Hourly limit</span>
                <input className="field-input" type="number" value={form.hourly_limit} onChange={(event) => setForm({ ...form, hourly_limit: Number(event.target.value) })} />
              </label>
              <label className="field-shell">
                <span className="field-label">Status</span>
                <select className="field-input" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>

            <label className="field-shell flex-row items-center justify-between gap-4">
              <div>
                <span className="field-label">Enable warm-up automation</span>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Send low-risk warm-up traffic before adding the mailbox to full campaign rotation.
                </p>
              </div>
              <input checked={form.warmup_enabled} onChange={(event) => setForm({ ...form, warmup_enabled: event.target.checked })} type="checkbox" className="h-5 w-5 rounded border-slate-300 text-blue-600" />
            </label>
          </div>
        </form>
      </Modal>
    </div>
  );
}
