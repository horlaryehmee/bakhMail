import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, Mail, MessagesSquare, ServerCog, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { MetricCard } from '../components/MetricCard';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { PerformanceChart } from '../components/charts/PerformanceChart';
import { api } from '../lib/api';

export function DashboardPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api
      .get('/api/dashboard')
      .then(setData)
      .catch(() => toast.error('Could not load the dashboard'));
  }, []);

  if (!data) {
    return <div className="surface-card p-8 text-slate-500">Loading dashboard...</div>;
  }

  const rates = [
    ['Delivery rate', `${data.analytics.totals.delivery_rate}%`],
    ['Open rate', `${data.analytics.totals.open_rate}%`],
    ['Click rate', `${data.analytics.totals.click_rate}%`],
    ['Reply rate', `${data.analytics.totals.reply_rate}%`],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace overview"
        title="Campaign performance, mailbox health, and reply pressure in one view."
        description="Use this workspace to judge daily sending conditions quickly: volume, engagement movement, pending replies, and operational readiness."
        stats={[
          { label: 'Reply queue', value: data.stats.replies_pending },
          { label: 'Delivery rate', value: `${data.analytics.totals.delivery_rate}%` },
          { label: 'Open rate', value: `${data.analytics.totals.open_rate}%` },
        ]}
        actions={
          <>
            <Link className="ghost-button" to="/contacts">
              Review contacts
            </Link>
            <Link className="primary-button" to="/campaigns">
              Open campaigns
            </Link>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Contacts" value={data.stats.contacts} hint="Reachable leads" icon={Users} tone="blue" />
        <MetricCard label="Campaigns" value={data.stats.campaigns} hint="Draft + active" icon={Mail} tone="violet" />
        <MetricCard label="Mailboxes" value={data.stats.email_accounts} hint="Connected lanes" icon={ServerCog} tone="emerald" />
        <MetricCard label="Unread alerts" value={data.stats.replies_pending} hint="Needs review" icon={BellRing} tone="amber" />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.55fr_0.95fr]">
        <PerformanceChart data={data.analytics.timeline} />

        <section className="surface-card p-5 sm:p-6">
          <div className="space-y-2">
            <p className="eyebrow !text-[0.64rem] !tracking-[0.24em]">Delivery health</p>
            <h3 className="text-2xl font-semibold text-slate-950">Top-line engagement</h3>
            <p className="text-sm leading-6 text-slate-500">
              The critical rates that tell you whether list quality and inbox placement are holding up.
            </p>
          </div>

          <div className="mt-6 space-y-3">
            {rates.map(([label, value]) => (
              <div key={label} className="surface-card-muted flex items-center justify-between px-4 py-4">
                <div>
                  <p className="text-sm font-semibold text-slate-950">{label}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">Last 14 days</p>
                </div>
                <span className="text-2xl font-semibold text-slate-950">{value}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-[24px] bg-slate-50 px-4 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <MessagesSquare size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-950">Reply handling</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Reply detection and suppression stay active while campaigns are live, so follow-up volume does not outrun inbox reality.
                  </p>
                </div>
              </div>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="surface-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="eyebrow !text-[0.64rem] !tracking-[0.24em]">Recent campaigns</p>
              <h3 className="text-2xl font-semibold text-slate-950">Launch board</h3>
            </div>
            <Link className="ghost-button" to="/campaigns">
              View all
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {data.recent_campaigns.length ? (
              data.recent_campaigns.map((campaign) => (
                <div key={campaign.id} className="surface-card-muted p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <h4 className="text-lg font-semibold text-slate-950">{campaign.name}</h4>
                      <p className="text-sm text-slate-500">{campaign.subject || 'No subject configured yet'}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={campaign.status} />
                      <span className="text-sm text-slate-500">
                        {campaign.scheduled_at ? new Date(campaign.scheduled_at).toLocaleString() : 'Immediate send'}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-panel p-6 text-sm">No campaigns have been created yet.</div>
            )}
          </div>
        </section>

        <section className="surface-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="eyebrow !text-[0.64rem] !tracking-[0.24em]">Activity log</p>
              <h3 className="text-2xl font-semibold text-slate-950">Recent operator actions</h3>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {data.recent_activity.length ? (
              data.recent_activity.map((activity) => (
                <div key={activity.id} className="surface-card-muted p-4">
                  <p className="font-semibold text-slate-950">{activity.description || activity.action}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                    {new Date(activity.created_at).toLocaleString()}
                  </p>
                </div>
              ))
            ) : (
              <div className="empty-panel p-6 text-sm">No activity has been recorded yet.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
