import { useEffect, useMemo, useState } from 'react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Eye, GripVertical, MailPlus, Play, Plus, Sparkles, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '../components/Modal';
import { MetricCard } from '../components/MetricCard';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { api } from '../lib/api';

function createEmptyCampaign() {
  return {
    name: '',
    subject: '',
    preview_text: '',
    builder_type: 'visual',
    template_html: '<p>Hi {{first_name}},</p><p>I wanted to reach out because...</p>',
    template_text: 'Hi {{first_name}}, I wanted to reach out because...',
    selected_email_account_ids: [],
    audience_filters: { search: '', group_ids: [], tag_ids: [], status: 'active' },
    scheduled_at: '',
    steps: [
      {
        id: 'step-1',
        name: 'Opening email',
        subject: 'Quick question for {{company}}',
        delay_hours: 0,
        body_html: '<p>Hi {{first_name}},</p><p>I wanted to reach out because...</p>',
      },
    ],
  };
}

function SortableStep({ step, onChange, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: step.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="surface-card-muted p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Sequence step</p>
          <h4 className="mt-2 text-lg font-semibold text-slate-950">{step.name || 'Untitled step'}</h4>
        </div>
        <div className="flex gap-2">
          <button type="button" className="ghost-button !p-3" {...attributes} {...listeners} aria-label="Drag step">
            <GripVertical size={16} />
          </button>
          <button type="button" className="ghost-button !p-3" onClick={() => onRemove(step.id)} aria-label="Remove step">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="grid gap-3">
        <label className="field-shell">
          <span className="field-label">Step name</span>
          <input className="field-input" value={step.name} onChange={(event) => onChange(step.id, { ...step, name: event.target.value })} />
        </label>
        <label className="field-shell">
          <span className="field-label">Subject</span>
          <input className="field-input" value={step.subject} onChange={(event) => onChange(step.id, { ...step, subject: event.target.value })} />
        </label>
        <label className="field-shell">
          <span className="field-label">Delay (hours)</span>
          <input
            className="field-input"
            type="number"
            min="0"
            value={step.delay_hours}
            onChange={(event) => onChange(step.id, { ...step, delay_hours: Number(event.target.value) })}
          />
        </label>
        <label className="field-shell">
          <span className="field-label">HTML body</span>
          <textarea
            className="field-input min-h-32"
            value={step.body_html}
            onChange={(event) => onChange(step.id, { ...step, body_html: event.target.value })}
          />
        </label>
      </div>
    </div>
  );
}

export function CampaignsPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [filters, setFilters] = useState({ tags: [], groups: [] });
  const [modalOpen, setModalOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');
  const [form, setForm] = useState(createEmptyCampaign());
  const [editingId, setEditingId] = useState(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function load() {
    const [campaignResponse, accountResponse, contactResponse] = await Promise.all([
      api.get('/api/campaigns'),
      api.get('/api/email-accounts'),
      api.get('/api/contacts'),
    ]);

    setCampaigns(campaignResponse.data || []);
    setAccounts(accountResponse.data || []);
    setFilters(contactResponse.filters || { tags: [], groups: [] });
  }

  useEffect(() => {
    load().catch(() => toast.error('Could not load campaigns'));
  }, []);

  const orderedSteps = useMemo(
    () => form.steps.map((step, index) => ({ ...step, step_order: index + 1 })),
    [form.steps],
  );
  const liveCampaigns = campaigns.filter((campaign) => ['active', 'queued', 'scheduled', 'running'].includes(campaign.status)).length;
  const draftCampaigns = campaigns.filter((campaign) => campaign.status === 'draft').length;

  function openNewModal() {
    setEditingId(null);
    setForm(createEmptyCampaign());
    setModalOpen(true);
  }

  function updateStep(id, nextStep) {
    setForm((current) => ({
      ...current,
      steps: current.steps.map((step) => (step.id === id ? nextStep : step)),
    }));
  }

  function removeStep(id) {
    setForm((current) => ({
      ...current,
      steps: current.steps.filter((step) => step.id !== id),
    }));
  }

  function addStep() {
    setForm((current) => ({
      ...current,
      steps: [
        ...current.steps,
        {
          id: `step-${crypto.randomUUID()}`,
          name: `Follow-up ${current.steps.length}`,
          subject: current.subject || 'Checking in on my last note',
          delay_hours: 48,
          body_html: '<p>Hi {{first_name}},</p><p>Circling back on my previous note.</p>',
        },
      ],
    }));
  }

  function onDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setForm((current) => {
      const oldIndex = current.steps.findIndex((step) => step.id === active.id);
      const newIndex = current.steps.findIndex((step) => step.id === over.id);
      return { ...current, steps: arrayMove(current.steps, oldIndex, newIndex) };
    });
  }

  async function saveCampaign(event) {
    event.preventDefault();

    const payload = { ...form, scheduled_at: form.scheduled_at || null, steps: orderedSteps };

    try {
      if (editingId) {
        await api.put(`/api/campaigns/${editingId}`, payload);
        toast.success('Campaign updated');
      } else {
        await api.post('/api/campaigns', payload);
        toast.success('Campaign created');
      }

      setModalOpen(false);
      setForm(createEmptyCampaign());
      setEditingId(null);
      load();
    } catch (error) {
      toast.error(error.payload?.message || 'Could not save campaign');
    }
  }

  async function startEdit(id) {
    try {
      const response = await api.get(`/api/campaigns/${id}`);
      const campaign = response.data;
      setEditingId(id);
      setForm({
        ...campaign,
        scheduled_at: campaign.scheduled_at ? campaign.scheduled_at.slice(0, 16) : '',
        audience_filters: {
          search: '',
          group_ids: [],
          tag_ids: [],
          status: 'active',
          ...(campaign.audience_filters || {}),
        },
        steps: (campaign.steps || []).map((step) => ({ ...step, id: String(step.id) })),
      });
      setModalOpen(true);
    } catch {
      toast.error('Could not load campaign details');
    }
  }

  async function launchCampaign(id) {
    try {
      await api.post(`/api/campaigns/${id}/launch`, {});
      toast.success('Campaign queued');
      load();
    } catch (error) {
      toast.error(error.payload?.message || 'Could not queue campaign');
    }
  }

  async function previewCampaign(id) {
    try {
      const response = await api.get(`/api/campaigns/${id}/preview`);
      setPreviewSubject(response.data.subject);
      setPreviewHtml(response.data.html);
      setPreviewOpen(true);
    } catch {
      toast.error('Could not build preview');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Campaign builder"
        title="Build sequenced outreach with clearer control over timing, senders, and audience."
        description="Create campaigns, rotate mailboxes deliberately, shape audience filters, and manage follow-up logic from one working surface."
        stats={[
          { label: 'Campaigns', value: campaigns.length },
          { label: 'Live', value: liveCampaigns },
          { label: 'Drafts', value: draftCampaigns },
        ]}
        actions={
          <button className="primary-button" type="button" onClick={openNewModal}>
            <Plus size={16} />
            <span>New campaign</span>
          </button>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Draft campaigns" value={draftCampaigns} hint="Pending review" tone="violet" />
        <MetricCard label="Live campaigns" value={liveCampaigns} hint="Queued or sending" tone="emerald" />
        <MetricCard label="Connected mailboxes" value={accounts.length} hint="Available senders" tone="blue" />
      </section>

      <section className="surface-card table-shell">
        <div className="overflow-x-auto">
          <table className="data-table min-w-[980px] text-left">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Status</th>
                <th>Recipients</th>
                <th>Steps</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.length ? (
                campaigns.map((campaign) => (
                  <tr key={campaign.id}>
                    <td>
                      <div className="font-semibold text-slate-950">{campaign.name}</div>
                      <div className="mt-1 text-sm text-slate-500">{campaign.subject || 'No subject line set'}</div>
                    </td>
                    <td>
                      <StatusBadge status={campaign.status} />
                    </td>
                    <td>{campaign.total_recipients || campaign.recipients_count || 0}</td>
                    <td>{campaign.steps_count || 0}</td>
                    <td>
                      <div className="flex justify-end gap-2">
                        <button className="ghost-button" type="button" onClick={() => previewCampaign(campaign.id)}>
                          <Eye size={16} />
                          Preview
                        </button>
                        <button className="ghost-button" type="button" onClick={() => startEdit(campaign.id)}>
                          Edit
                        </button>
                        <button className="primary-button" type="button" onClick={() => launchCampaign(campaign.id)}>
                          <Play size={16} />
                          Launch
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-panel m-4 p-6 text-center text-sm">
                      No campaigns created yet. Start a new campaign to build your first sequence.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={modalOpen}
        title={editingId ? 'Edit campaign' : 'Create campaign'}
        onClose={() => setModalOpen(false)}
        width="max-w-7xl"
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            <button className="ghost-button" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button className="primary-button" type="submit" form="campaign-form">
              {editingId ? 'Save campaign' : 'Create campaign'}
            </button>
          </div>
        }
      >
        <form id="campaign-form" className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]" onSubmit={saveCampaign}>
          <div className="space-y-4">
            <div className="surface-card-muted p-5">
              <p className="eyebrow !text-[0.64rem] !tracking-[0.24em]">Campaign setup</p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-950">Core campaign details</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Define the campaign identity, sending lane, schedule, and audience before you put volume into motion.
              </p>
            </div>

            <label className="field-shell">
              <span className="field-label">Campaign name</span>
              <input className="field-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
            <label className="field-shell">
              <span className="field-label">Subject line</span>
              <input className="field-input" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} />
            </label>
            <label className="field-shell">
              <span className="field-label">Preview text</span>
              <input
                className="field-input"
                value={form.preview_text}
                onChange={(event) => setForm({ ...form, preview_text: event.target.value })}
              />
            </label>
            <label className="field-shell">
              <span className="field-label">Schedule</span>
              <input
                className="field-input"
                type="datetime-local"
                value={form.scheduled_at}
                onChange={(event) => setForm({ ...form, scheduled_at: event.target.value })}
              />
            </label>

            <label className="field-shell">
              <span className="field-label">Mailbox rotation</span>
              <select
                className="field-input min-h-40"
                multiple
                value={form.selected_email_account_ids}
                onChange={(event) =>
                  setForm({
                    ...form,
                    selected_email_account_ids: Array.from(event.target.selectedOptions).map((option) => Number(option.value)),
                  })
                }
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.email_address}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="field-shell">
                <span className="field-label">Tag segments</span>
                <select
                  className="field-input min-h-32"
                  multiple
                  value={form.audience_filters.tag_ids}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      audience_filters: {
                        ...form.audience_filters,
                        tag_ids: Array.from(event.target.selectedOptions).map((option) => Number(option.value)),
                      },
                    })
                  }
                >
                  {filters.tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-shell">
                <span className="field-label">Group segments</span>
                <select
                  className="field-input min-h-32"
                  multiple
                  value={form.audience_filters.group_ids}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      audience_filters: {
                        ...form.audience_filters,
                        group_ids: Array.from(event.target.selectedOptions).map((option) => Number(option.value)),
                      },
                    })
                  }
                >
                  {filters.groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="field-shell">
              <span className="field-label">Builder HTML</span>
              <textarea
                className="field-input min-h-44"
                value={form.template_html}
                onChange={(event) => setForm({ ...form, template_html: event.target.value })}
              />
            </label>
            <label className="field-shell">
              <span className="field-label">Plain text fallback</span>
              <textarea
                className="field-input min-h-28"
                value={form.template_text}
                onChange={(event) => setForm({ ...form, template_text: event.target.value })}
              />
            </label>
          </div>

          <div className="space-y-4">
            <div className="surface-card-muted p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="eyebrow !text-[0.64rem] !tracking-[0.24em]">Sequence builder</p>
                  <h3 className="mt-2 text-2xl font-semibold text-slate-950">Follow-up flow</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Reorder steps by dragging them. Use placeholders like <code>{'{{first_name}}'}</code> and <code>{'{{company}}'}</code> to keep copy personalized without losing control.
                  </p>
                </div>
                <button className="ghost-button" type="button" onClick={addStep}>
                  <MailPlus size={16} />
                  Add step
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {['{{first_name}}', '{{company}}', '{{job_title}}', '{{location}}'].map((token) => (
                  <span key={token} className="status-badge status-badge--slate">
                    {token}
                  </span>
                ))}
              </div>
            </div>

            <div className="surface-card-muted p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                  <Sparkles size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-950">Builder notes</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Keep the opening email tight, then stage follow-ups deliberately so send volume stays believable.
                  </p>
                </div>
              </div>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={form.steps.map((step) => step.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-4">
                  {orderedSteps.map((step) => (
                    <SortableStep key={step.id} step={step} onChange={updateStep} onRemove={removeStep} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </form>
      </Modal>

      <Modal open={previewOpen} title={`Preview: ${previewSubject || 'Campaign email'}`} onClose={() => setPreviewOpen(false)}>
        <div className="surface-card-muted rounded-[24px] p-5">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Rendered preview</p>
            <h4 className="mt-2 text-lg font-semibold text-slate-950">{previewSubject || 'Untitled email'}</h4>
          </div>
          <div className="rounded-[20px] border border-slate-200 bg-white p-5 text-sm leading-7 text-slate-700" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </div>
      </Modal>
    </div>
  );
}
