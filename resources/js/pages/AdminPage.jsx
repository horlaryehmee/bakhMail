import { useEffect, useState } from 'react';
import { Bot, Gauge, KeyRound, Shield, Sparkles, Users, Waypoints } from 'lucide-react';
import toast from 'react-hot-toast';
import { MetricCard } from '../components/MetricCard';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { api } from '../lib/api';

function formatNumber(value) {
  return value == null ? 'Not available' : new Intl.NumberFormat().format(Number(value));
}

export function AdminPage() {
  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState({});
  const [groqModels, setGroqModels] = useState([]);
  const [groqApiKey, setGroqApiKey] = useState('');
  const [groqApiKeyConfigured, setGroqApiKeyConfigured] = useState(false);
  const [groqStatus, setGroqStatus] = useState(null);
  const [responsePrompt, setResponsePrompt] = useState('Tell me a three sentence bedtime story about a unicorn.');
  const [groqResult, setGroqResult] = useState(null);
  const [groqBusy, setGroqBusy] = useState(false);
  const [migrationBusy, setMigrationBusy] = useState(false);
  const [migrationOutput, setMigrationOutput] = useState('');

  async function load() {
    const [summaryResponse, usersResponse, settingsResponse, groqStatusResponse] = await Promise.all([
      api.get('/api/admin/summary'),
      api.get('/api/admin/users'),
      api.get('/api/admin/settings'),
      api.get('/api/admin/groq/status'),
    ]);

    setSummary(summaryResponse);
    setUsers(usersResponse.data || []);
    setSettings(settingsResponse.data || {});
    setGroqApiKey('');
    setGroqApiKeyConfigured(Boolean(settingsResponse.meta?.groq_api_key_configured));
    setGroqStatus(groqStatusResponse);

    if (groqStatusResponse.configured) {
      try {
        const groqModelsResponse = await api.get('/api/admin/groq/models');
        setGroqModels(groqModelsResponse.data || []);
      } catch {
        setGroqModels([]);
      }
    } else {
      setGroqModels([]);
    }
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
      const payload = {
        ...settings,
      };

      if (groqApiKey.trim()) {
        payload.groq_api_key = groqApiKey.trim();
      }

      await api.put('/api/admin/settings', { settings: payload });
      setGroqApiKey('');
      setGroqApiKeyConfigured(groqApiKeyConfigured || Boolean(payload.groq_api_key));
      const groqStatusResponse = await api.get('/api/admin/groq/status');
      setGroqStatus(groqStatusResponse);
      if (groqStatusResponse.configured) {
        try {
          const groqModelsResponse = await api.get('/api/admin/groq/models');
          setGroqModels(groqModelsResponse.data || []);
        } catch {
          setGroqModels([]);
        }
      }
      toast.success('Settings saved');
    } catch (error) {
      toast.error(error.payload?.errors?.['settings.groq_api_key']?.[0] || error.payload?.message || 'Could not save settings');
    }
  }

  async function runGroqResponse() {
    setGroqBusy(true);

    try {
      const response = await api.post('/api/admin/groq/responses', {
        model: settings.groq_response_model || groqStatus?.default_response_model,
        input: responsePrompt,
      });
      setGroqResult(response);
      setGroqStatus((currentStatus) => currentStatus ? {
        ...currentStatus,
        usage_today: response.usage_today,
        daily_limits: response.daily_limits,
        provider_limits: response.provider_limits,
      } : currentStatus);
      toast.success('Groq response ran');
    } catch (error) {
      toast.error(error.payload?.message || 'Could not run Groq response');
    } finally {
      setGroqBusy(false);
    }
  }

  async function runDatabaseUpdate() {
    setMigrationBusy(true);

    try {
      const response = await api.post('/api/admin/database/migrate', {});
      setMigrationOutput(response.output || 'Database is up to date.');
      await load();
      toast.success('Database update completed');
    } catch (error) {
      setMigrationOutput(error.payload?.message || error.message || 'Database update failed');
      toast.error(error.payload?.message || error.message || 'Could not update database');
    } finally {
      setMigrationBusy(false);
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

      <section className="surface-card p-5 sm:p-6">
        <p className="eyebrow !text-[0.64rem] !tracking-[0.24em]">Database maintenance</p>
        <h3 className="mt-2 text-2xl font-semibold text-slate-950">Update database tables</h3>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
          Run pending Laravel migrations from the admin panel. Use this when a live deployment is missing tables or columns after an update.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button className="primary-button" type="button" onClick={runDatabaseUpdate} disabled={migrationBusy}>
            <Waypoints size={16} />
            {migrationBusy ? 'Updating database...' : 'Update database'}
          </button>
          <span className="text-sm text-slate-500">This runs pending migrations with force enabled.</span>
        </div>
        {migrationOutput ? (
          <pre className="mt-4 overflow-x-auto rounded-[20px] border border-slate-200 bg-slate-950 px-4 py-3 text-xs leading-6 text-slate-100 whitespace-pre-wrap">
            {migrationOutput}
          </pre>
        ) : null}
      </section>

      <section className="surface-card p-5 sm:p-6">
        <div className="groq-studio">
          <div className="groq-studio__hero">
            <div className="groq-studio__hero-copy">
              <div className="groq-studio__icon">
                <Bot size={20} />
              </div>
              <div>
                <p className="eyebrow !text-[0.64rem] !tracking-[0.24em]">Groq AI</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-950">Inference and usage controls</h3>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                  Run Groq prompts, monitor token burn, and manage the current free-plan budget from one surface without digging through raw JSON.
                </p>
              </div>
            </div>
            <div className="groq-studio__hero-meta">
              <StatusBadge
                status={groqStatus?.verified ? 'verified' : groqStatus?.configured ? 'saved only' : 'not configured'}
                tone={groqStatus?.verified ? 'emerald' : groqStatus?.configured ? 'amber' : 'rose'}
              />
              <StatusBadge status={groqStatus?.resolved_response_model || 'no model'} tone="slate" />
              <div className="groq-hero-inline-stat">
                <span className="groq-hero-inline-stat__label">Today</span>
                <strong className="groq-hero-inline-stat__value">{formatNumber(groqStatus?.usage_today?.total_tokens)} tokens</strong>
              </div>
            </div>
          </div>

          <div className="groq-studio__grid">
            <div className="groq-studio__main">
              <div className="surface-card-muted groq-panel">
                <div className="groq-panel__header">
                  <div>
                    <p className="groq-panel__eyebrow">Prompt studio</p>
                    <h4 className="groq-panel__title">Run a response</h4>
                  </div>
                  <button className="primary-button" type="button" onClick={runGroqResponse} disabled={groqBusy || !groqStatus?.configured}>
                    <Sparkles size={16} />
                    {groqBusy ? 'Running...' : 'Run response'}
                  </button>
                </div>
                <label className="field-shell groq-composer">
                  <span className="field-label">Responses input</span>
                  <textarea className="field-input min-h-40" value={responsePrompt} onChange={(event) => setResponsePrompt(event.target.value)} />
                </label>

                <div className="groq-result-strip">
                  <div className="groq-result-strip__item">
                    <span className="groq-result-strip__label">Model</span>
                    <strong>{groqResult?.model || groqStatus?.resolved_response_model || 'Not set'}</strong>
                  </div>
                  <div className="groq-result-strip__item">
                    <span className="groq-result-strip__label">Input</span>
                    <strong>{formatNumber(groqResult?.usage?.input_tokens)}</strong>
                  </div>
                  <div className="groq-result-strip__item">
                    <span className="groq-result-strip__label">Output</span>
                    <strong>{formatNumber(groqResult?.usage?.output_tokens)}</strong>
                  </div>
                  <div className="groq-result-strip__item">
                    <span className="groq-result-strip__label">Total</span>
                    <strong>{formatNumber(groqResult?.usage?.total_tokens)}</strong>
                  </div>
                </div>

                <div className="groq-output-panel">
                  <div className="groq-output-panel__header">
                    <div>
                      <p className="groq-panel__eyebrow">Latest output</p>
                      <h4 className="groq-panel__title">Text-only response</h4>
                    </div>
                    {groqResult?.status ? <StatusBadge status={groqResult.status} tone={groqResult.status === 'completed' ? 'emerald' : 'slate'} /> : null}
                  </div>
                  <div className="groq-output-panel__body">
                    {groqResult?.output_text ? (
                      <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                        {groqResult.output_text}
                      </div>
                    ) : (
                      <div className="text-sm leading-7 text-slate-500">
                        Run a prompt to see the generated text here. The backend now strips the raw Groq envelope and returns only the useful output plus usage metadata.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="groq-studio__secondary">
              <div className="surface-card-muted groq-panel groq-panel--tight">
                <div className="groq-panel__header">
                  <div className="flex items-center gap-3">
                    <div className="groq-mini-icon groq-mini-icon--blue">
                      <Gauge size={16} />
                    </div>
                    <div>
                      <p className="groq-panel__eyebrow">Live budget</p>
                      <h4 className="groq-panel__title">Usage snapshot</h4>
                    </div>
                  </div>
                </div>
                <div className="groq-stat-grid">
                  <div className="groq-stat-tile">
                    <span className="groq-stat-tile__label">Requests today</span>
                    <strong className="groq-stat-tile__value">{formatNumber(groqStatus?.usage_today?.request_count)}</strong>
                  </div>
                  <div className="groq-stat-tile">
                    <span className="groq-stat-tile__label">Tokens today</span>
                    <strong className="groq-stat-tile__value">{formatNumber(groqStatus?.usage_today?.total_tokens)}</strong>
                  </div>
                  <div className="groq-stat-tile">
                    <span className="groq-stat-tile__label">Req. remaining</span>
                    <strong className="groq-stat-tile__value">{formatNumber(groqStatus?.daily_limits?.requests_remaining_today)}</strong>
                  </div>
                  <div className="groq-stat-tile">
                    <span className="groq-stat-tile__label">Tokens remaining</span>
                    <strong className="groq-stat-tile__value">{formatNumber(groqStatus?.daily_limits?.tokens_remaining_today)}</strong>
                  </div>
                </div>
                <div className="groq-detail-list">
                  <div><span>Daily request limit</span><strong>{formatNumber(groqStatus?.daily_limits?.requests_per_day)}</strong></div>
                  <div><span>Daily token limit</span><strong>{formatNumber(groqStatus?.daily_limits?.tokens_per_day)}</strong></div>
                  <div><span>Limit source</span><strong>{groqStatus?.daily_limits?.source || 'Unknown'}</strong></div>
                  <div><span>Header req. remaining</span><strong>{formatNumber(groqStatus?.provider_limits?.requests_remaining)}</strong></div>
                  <div><span>Header tokens / min</span><strong>{formatNumber(groqStatus?.provider_limits?.tokens_remaining_minute)}</strong></div>
                </div>
              </div>

              <div className="surface-card-muted groq-panel groq-panel--tight">
                <div className="groq-panel__header">
                  <div className="flex items-center gap-3">
                    <div className="groq-mini-icon groq-mini-icon--amber">
                      <KeyRound size={16} />
                    </div>
                    <div>
                      <p className="groq-panel__eyebrow">Configuration</p>
                      <h4 className="groq-panel__title">Key and model</h4>
                    </div>
                  </div>
                </div>
                <label className="field-shell">
                  <span className="field-label">Groq API key</span>
                  <input
                    className="field-input"
                    type="password"
                    placeholder={groqApiKeyConfigured ? 'Stored securely. Enter a new key to replace it.' : 'Paste your Groq API key'}
                    value={groqApiKey}
                    onChange={(event) => setGroqApiKey(event.target.value)}
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="field-shell">
                    <span className="field-label">Groq model</span>
                    <select
                      className="field-input"
                      value={settings.groq_response_model ?? ''}
                      onChange={(event) => setSettings({ ...settings, groq_response_model: event.target.value })}
                    >
                      <option value="">Use default: {groqStatus?.default_response_model || 'llama-3.1-8b-instant'}</option>
                      {groqModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.id}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field-shell">
                    <span className="field-label">Base URL</span>
                    <input className="field-input" value={groqStatus?.base_url || ''} readOnly />
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="field-shell">
                    <span className="field-label">Daily request limit override</span>
                    <input
                      className="field-input"
                      inputMode="numeric"
                      value={settings.groq_daily_request_limit ?? ''}
                      onChange={(event) => setSettings({ ...settings, groq_daily_request_limit: event.target.value })}
                      placeholder="Leave blank for Groq free-plan default"
                    />
                  </label>
                  <label className="field-shell">
                    <span className="field-label">Daily token limit override</span>
                    <input
                      className="field-input"
                      inputMode="numeric"
                      value={settings.groq_daily_token_limit ?? ''}
                      onChange={(event) => setSettings({ ...settings, groq_daily_token_limit: event.target.value })}
                      placeholder="Leave blank for Groq free-plan default"
                    />
                  </label>
                </div>
                <div className="groq-detail-list">
                  <div><span>API key</span><strong>{groqApiKeyConfigured ? 'Stored in admin settings or env' : 'Not configured'}</strong></div>
                  <div><span>Verification</span><strong>{groqStatus?.verified ? 'Groq accepted the saved key' : groqStatus?.configured ? 'Saved but not verified by Groq' : 'Not checked'}</strong></div>
                  <div><span>Responses model</span><strong>{groqStatus?.resolved_response_model || 'Not set'}</strong></div>
                  <div><span>Available models</span><strong>{formatNumber(groqModels.length)}</strong></div>
                </div>
                {groqStatus?.message ? <p className="text-sm leading-6 text-rose-600">{groqStatus.message}</p> : null}
                <div className="flex flex-wrap gap-3">
                  <button className="primary-button" type="button" onClick={saveSettings}>
                    Save Groq settings
                  </button>
                  {groqApiKeyConfigured ? <StatusBadge status="key stored" tone="emerald" /> : null}
                </div>
              </div>

              <div className="surface-card-muted groq-panel groq-panel--tight">
                <div className="groq-panel__header">
                  <div className="flex items-center gap-3">
                    <div className="groq-mini-icon groq-mini-icon--emerald">
                      <Waypoints size={16} />
                    </div>
                    <div>
                      <p className="groq-panel__eyebrow">Provider readback</p>
                      <h4 className="groq-panel__title">Groq status</h4>
                    </div>
                  </div>
                </div>
                <div className="groq-detail-list">
                  <div><span>Configured</span><strong>{groqStatus?.configured ? 'Yes' : 'No'}</strong></div>
                  <div><span>Verified</span><strong>{groqStatus?.verified ? 'Yes' : 'No'}</strong></div>
                  <div><span>Requests reset</span><strong>{groqStatus?.provider_limits?.requests_reset_in || 'Not available'}</strong></div>
                  <div><span>Tokens reset</span><strong>{groqStatus?.provider_limits?.tokens_reset_in || 'Not available'}</strong></div>
                  <div><span>Retry after</span><strong>{groqStatus?.provider_limits?.retry_after || 'Not rate-limited'}</strong></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
