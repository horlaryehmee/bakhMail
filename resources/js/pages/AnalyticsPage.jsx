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
