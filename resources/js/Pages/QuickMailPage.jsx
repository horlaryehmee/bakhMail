import { useEffect, useMemo, useState } from 'react';
import { MailPlus, Send, Sparkles, Users } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { MetricCard } from '../components/MetricCard';
import { PageHeader } from '../components/PageHeader';
import { RichTextEditor } from '../components/RichTextEditor';
import { StatusBadge } from '../components/StatusBadge';
import { api } from '../lib/api';

function createQuickMailForm(accountId = '') {
  return {
    first_name: '',
    last_name: '',
    email: '',
    company: '',
    job_title: '',
    phone: '',
    website: '',
    location: '',
    notes: '',
    status: 'active',
    email_account_id: accountId,
    subject: '',
    body_html: '<p></p>',
    body_text: '',
  };
}

function trackingState(log) {
  if (!log) return null;
  if (log.clicked_at) return { label: 'clicked', tone: 'emerald' };
  if (log.opened_at) return { label: 'opened', tone: 'blue' };
  if (log.event_type === 'sent') return { label: 'sent', tone: 'amber' };
  if (log.event_type === 'failed') return { label: 'failed', tone: 'rose' };
  return { label: log.event_type, tone: 'slate' };
}

export function QuickMailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [sending, setSending] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiBrief, setAiBrief] = useState('');
  const [form, setForm] = useState(createQuickMailForm());

  const trackedContacts = useMemo(
    () => contacts.filter((contact) => contact.latest_email_log?.opened_at || contact.latest_email_log?.clicked_at).length,
    [contacts],
  );
  const recentOutreach = useMemo(
    () => contacts.filter((contact) => contact.latest_email_log).slice(0, 8),
    [contacts],
  );

  async function load() {
    const [accountsResponse, contactsResponse] = await Promise.all([
      api.get('/api/email-accounts'),
      api.get('/api/contacts'),
    ]);

    const nextAccounts = accountsResponse.data || [];
    const nextContacts = contactsResponse.data || [];

    setAccounts(nextAccounts);
    setContacts(nextContacts);
    setForm((current) => ({
      ...current,
      email_account_id: current.email_account_id || (nextAccounts[0] ? String(nextAccounts[0].id) : ''),
    }));
  }

  useEffect(() => {
    load().catch((error) => {
      toast.error(error.payload?.message || error.message || 'Could not load quick mail');
    });
  }, []);

  useEffect(() => {
    const contact = location.state?.contact;

    if (!contact) {
      return;
    }

    setForm((current) => ({
      ...current,
      first_name: contact.first_name || '',
      last_name: contact.last_name || '',
      email: contact.email || '',
      company: contact.company || '',
      job_title: contact.job_title || '',
      phone: contact.phone || '',
      website: contact.website || '',
      location: contact.location || '',
      notes: contact.notes || '',
      status: contact.status || 'active',
      subject: current.subject || `Quick question for ${contact.company || contact.full_name || contact.email}`,
    }));

    navigate(location.pathname, { replace: true, state: {} });
  }, [location, navigate]);

  function htmlToPlainText(html) {
    const node = document.createElement('div');
    node.innerHTML = String(html || '');

    return (node.textContent || node.innerText || '')
      .replace(/\u00a0/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  async function generateWithAi() {
    if (!aiBrief.trim()) {
      toast.error('Add a short brief for the AI first');
      return;
    }

    setAiBusy(true);

    try {
      const response = await api.post('/api/campaigns/generate', {
        brief: aiBrief,
        campaign_name: form.company ? `${form.company} quick outreach` : 'Quick outreach',
        subject: form.subject || '',
      });

      const draft = response.data?.draft;
      const firstStep = draft?.steps?.[0];
      const generatedHtml = firstStep?.body_html || '<p></p>';

      setForm((current) => ({
        ...current,
        subject: draft?.subject || firstStep?.subject || current.subject,
        body_html: generatedHtml,
        body_text: htmlToPlainText(generatedHtml),
      }));

      toast.success('AI draft generated');
    } catch (error) {
      toast.error(error.payload?.message || error.message || 'AI draft failed');
    } finally {
      setAiBusy(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSending(true);

    try {
      await api.post('/api/contacts/quick-send', {
        ...form,
        email_account_id: Number(form.email_account_id),
      });

      toast.success('Quick email sent');
      setForm(createQuickMailForm(accounts[0] ? String(accounts[0].id) : ''));
      load();
    } catch (error) {
      const firstError = Object.values(error.payload?.errors || {})?.[0]?.[0];
      toast.error(firstError || error.payload?.message || error.message || 'Could not send quick email');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Quick mail"
        title="Send a one-off cold email from its own workspace."
        description="Pick a sender mailbox, write the message with standard formatting tools, and save the contact automatically after the email is sent."
        stats={[
          { label: 'Mailboxes', value: accounts.length },
          { label: 'Recent sends', value: recentOutreach.length },
          { label: 'Tracked', value: trackedContacts },
        ]}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Connected mailboxes" value={accounts.length} hint="Available senders" icon={Send} tone="blue" />
        <MetricCard label="Recent outreach" value={recentOutreach.length} hint="Tracked one-off sends" icon={MailPlus} tone="emerald" />
        <MetricCard label="Known contacts" value={contacts.length} hint="Saved prospects" icon={Users} tone="amber" />
      </section>

      <section className="surface-card p-5 sm:p-6">
        <form onSubmit={handleSubmit}>
          <div className="border-b border-slate-200 pb-5">
            <p className="eyebrow !text-[0.64rem] !tracking-[0.24em]">Compose and send</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">Standard editor with classic formatting controls</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Use headings, bold, lists, links, and text alignment directly in the message body.
            </p>
          </div>

          <div className="mt-6 surface-card-muted rounded-[24px] p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
              <label className="field-shell flex-1">
                <span className="field-label">AI brief</span>
                <textarea
                  className="field-input min-h-28"
                  value={aiBrief}
                  onChange={(event) => setAiBrief(event.target.value)}
                  placeholder="Describe the offer, audience, tone, CTA, and any constraints for the quick cold email."
                />
              </label>
              <button className="primary-button lg:mb-1" type="button" onClick={generateWithAi} disabled={aiBusy}>
                <Sparkles size={16} />
                <span>{aiBusy ? 'Generating...' : 'Draft with AI'}</span>
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {[
              ['first_name', 'First name', 'text'],
              ['last_name', 'Last name', 'text'],
              ['email', 'Email', 'email'],
              ['company', 'Company', 'text'],
              ['job_title', 'Job title', 'text'],
              ['phone', 'Phone', 'text'],
              ['website', 'Website', 'text'],
              ['location', 'Location', 'text'],
            ].map(([key, label, type]) => (
              <label key={key} className="field-shell">
                <span className="field-label">{label}</span>
                <input
                  className="field-input"
                  type={type}
                  value={form[key]}
                  onChange={(event) => setForm({ ...form, [key]: event.target.value })}
                />
              </label>
            ))}

            <label className="field-shell">
              <span className="field-label">Contact status</span>
              <select className="field-input" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>

            <label className="field-shell">
              <span className="field-label">Sender mailbox</span>
              <select
                className="field-input"
                value={form.email_account_id}
                onChange={(event) => setForm({ ...form, email_account_id: event.target.value })}
              >
                <option value="">Select a mailbox</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.email_address}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 grid gap-4">
            <label className="field-shell">
              <span className="field-label">Subject</span>
              <input
                className="field-input"
                value={form.subject}
                onChange={(event) => setForm({ ...form, subject: event.target.value })}
                placeholder="Short, direct subject line"
              />
            </label>

            <div className="field-shell">
              <span className="field-label">Email body</span>
              <RichTextEditor
                value={form.body_html}
                onChange={({ html, text }) => setForm((current) => ({ ...current, body_html: html, body_text: text }))}
                placeholder="Write the email and use the toolbar for H1, bold, lists, links, and alignment."
              />
            </div>

            <label className="field-shell">
              <span className="field-label">Internal notes</span>
              <textarea
                className="field-input min-h-24"
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                placeholder="Optional context about the prospect or offer."
              />
            </label>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              Opens, clicks, replies, and unsubscribes are still tracked automatically after send.
            </p>
            <button className="primary-button" type="submit" disabled={sending || !accounts.length}>
              <MailPlus size={16} />
              <span>{sending ? 'Sending...' : 'Send quick mail'}</span>
            </button>
          </div>
        </form>
      </section>

      <section className="surface-card p-5 sm:p-6">
        <div className="border-b border-slate-200 pb-5">
          <p className="eyebrow !text-[0.64rem] !tracking-[0.24em]">Recent tracked sends</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Latest quick outreach activity</h2>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {recentOutreach.length ? (
            recentOutreach.map((contact) => {
              const state = trackingState(contact.latest_email_log);

              return (
                <div key={contact.id} className="surface-card-muted p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-950">{contact.full_name}</div>
                      <div className="mt-1 text-sm text-slate-500">{contact.email}</div>
                    </div>
                    {state ? <StatusBadge status={state.label} tone={state.tone} /> : null}
                  </div>
                  <div className="mt-3 text-sm text-slate-600">{contact.latest_email_log?.subject || 'No subject'}</div>
                  <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                    {contact.latest_email_log?.sent_at ? new Date(contact.latest_email_log.sent_at).toLocaleString() : 'Pending'}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="empty-panel p-6 text-sm md:col-span-2 xl:col-span-3">
              No quick-mail sends yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
