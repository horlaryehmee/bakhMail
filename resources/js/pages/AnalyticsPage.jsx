import { useEffect, useState } from 'react';
import { Download, FileText, MailCheck, MousePointerClick, SendHorizontal, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { MetricCard } from '../components/MetricCard';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { PerformanceChart } from '../components/charts/PerformanceChart';
import { api } from '../lib/api';

export function AnalyticsPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api
      .get('/api/analytics')
      .then(setData)
      .catch(() => toast.error('Could not load analytics'));
  }, []);

  if (!data) {
    return <div className="surface-card p-8 text-slate-500">Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Campaign analytics"
        title="See what volume, engagement, and reply quality look like over time."
        description="Track send performance from first delivery through reply so you can compare campaigns, spot decay, and adjust lists or copy quickly."
        stats={[
          { label: 'Delivery', value: `${data.totals.delivery_rate}%` },
          { label: 'Open', value: `${data.totals.open_rate}%` },
          { label: 'Reply', value: `${data.totals.reply_rate}%` },
        ]}
        actions={
          <>
            <a className="ghost-button" href="/api/analytics/export/csv">
              <Download size={16} />
              Export CSV
            </a>
            <button className="primary-button" type="button" onClick={() => window.print()}>
              <FileText size={16} />
              Save as PDF
            </button>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Sent" value={data.totals.sent} hint="Outbound volume" icon={SendHorizontal} tone="blue" />
        <MetricCard label="Delivery" value={`${data.totals.delivery_rate}%`} hint="Inbox placement" icon={MailCheck} tone="emerald" />
        <MetricCard label="Open" value={`${data.totals.open_rate}%`} hint="Unique opens" icon={TrendingUp} tone="violet" />
        <MetricCard label="Reply" value={`${data.totals.reply_rate}%`} hint="Conversation rate" icon={MousePointerClick} tone="amber" />
      </section>

      <PerformanceChart data={data.timeline} />

      <section className="surface-card">
        <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
          <p className="eyebrow !text-[0.64rem] !tracking-[0.24em]">Quick mail analytics</p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-950">Detailed performance for one-off sends</h3>
        </div>

        <div className="grid gap-4 px-5 py-5 sm:px-6 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Sent"
            value={data.quick_mail?.totals?.sent || 0}
            hint="Quick Mail volume"
            icon={SendHorizontal}
            tone="blue"
          />
          <MetricCard
            label="Replies"
            value={data.quick_mail?.totals?.replies || 0}
            hint="Reply count"
            icon={MousePointerClick}
            tone="emerald"
          />
          <MetricCard
            label="Bounces"
            value={data.quick_mail?.totals?.bounces || 0}
            hint="Bounce count"
            icon={MailCheck}
            tone="rose"
          />
          <MetricCard
            label="Reply rate"
            value={`${data.quick_mail?.totals?.reply_rate || 0}%`}
            hint="Replies / sent"
            icon={TrendingUp}
            tone="amber"
          />
        </div>

        <div className="overflow-x-auto border-t border-slate-200">
          <table className="data-table min-w-[920px] text-left">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Sent</th>
                <th>Replies</th>
                <th>Bounces</th>
                <th>Reply rate</th>
                <th>Signals</th>
              </tr>
            </thead>
            <tbody>
              {data.quick_mail?.messages?.length ? (
                data.quick_mail.messages.map((message) => (
                  <tr key={message.id}>
                    <td>
                      <div className="font-semibold text-slate-950">{message.contact_name || 'Unknown contact'}</div>
                      <div className="mt-1 text-sm text-slate-500">{message.recipient_email}</div>
                    </td>
                    <td className="font-medium text-slate-700">{message.subject || 'No subject'}</td>
                    <td>
                      <StatusBadge status={message.status} />
                    </td>
                    <td>{message.sent_at ? new Date(message.sent_at).toLocaleString() : 'Pending'}</td>
                    <td>{message.replies}</td>
                    <td>{message.bounces}</td>
                    <td className="font-semibold text-slate-950">{message.reply_rate}%</td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        {message.opened ? <span className="status-badge status-badge--blue">Opened</span> : null}
                        {message.clicked ? <span className="status-badge status-badge--emerald">Clicked</span> : null}
                        {!message.opened && !message.clicked ? <span className="text-sm text-slate-400">No signals</span> : null}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-panel m-4 p-6 text-center text-sm">
                      No Quick Mail analytics are available yet.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="surface-card table-shell">
        <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
          <p className="eyebrow !text-[0.64rem] !tracking-[0.24em]">Campaign comparison</p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-950">Recent campaign performance</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table min-w-[760px] text-left">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Status</th>
                <th>Sent</th>
                <th>Replies</th>
                <th>Bounces</th>
                <th>Reply rate</th>
              </tr>
            </thead>
            <tbody>
              {data.campaigns.length ? (
                data.campaigns.map((campaign) => (
                  <tr key={campaign.id}>
                    <td className="font-semibold text-slate-950">{campaign.name}</td>
                    <td>
                      <StatusBadge status={campaign.status} />
                    </td>
                    <td>{campaign.sent}</td>
                    <td>{campaign.replies}</td>
                    <td>{campaign.bounces}</td>
                    <td className="font-semibold text-slate-950">{campaign.reply_rate}%</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-panel m-4 p-6 text-center text-sm">
                      No campaign analytics are available yet.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
