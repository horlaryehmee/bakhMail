import { useEffect, useMemo, useState } from 'react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Eye,
  GripVertical,
  Image as ImageIcon,
  LayoutTemplate,
  MailPlus,
  Monitor,
  Play,
  Plus,
  SeparatorHorizontal,
  Smartphone,
  Sparkles,
  TextCursor,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '../components/Modal';
import { MetricCard } from '../components/MetricCard';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { api } from '../lib/api';

const PLACEHOLDER_TOKENS = ['{{first_name}}', '{{company}}', '{{job_title}}', '{{location}}'];
const CAMPAIGN_WIZARD_STEPS = [
  { id: 'builder', label: 'Build email', description: 'Design the opening email' },
  { id: 'details', label: 'Campaign details', description: 'Audience, sender, and timing' },
  { id: 'sequence', label: 'Follow-up flow', description: 'Steps and final review' },
];
const BUILDER_MODULES = [
  { type: 'text', label: 'Text', icon: TextCursor },
  { type: 'image', label: 'Image', icon: ImageIcon },
  { type: 'button', label: 'Button', icon: LayoutTemplate },
  { type: 'divider', label: 'Divider', icon: SeparatorHorizontal },
];

function blockId(prefix = 'block') {
  return `${prefix}-${crypto.randomUUID()}`;
}

function createTextBlock(overrides = {}) {
  return {
    id: blockId('text'),
    type: 'text',
    content: 'Write a sharp, concise paragraph that feels written by a person, not a template.',
    align: 'left',
    color: '#201a16',
    fontSize: 17,
    paddingTop: 18,
    paddingBottom: 18,
    ...overrides,
  };
}

function createImageBlock(overrides = {}) {
  return {
    id: blockId('image'),
    type: 'image',
    src: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
    alt: 'Campaign hero image',
    paddingTop: 0,
    paddingBottom: 12,
    ...overrides,
  };
}

function createButtonBlock(overrides = {}) {
  return {
    id: blockId('button'),
    type: 'button',
    label: 'Book a demo',
    href: 'https://example.com/demo',
    align: 'left',
    backgroundColor: '#171411',
    textColor: '#fffaf3',
    paddingTop: 8,
    paddingBottom: 12,
    ...overrides,
  };
}

function createDividerBlock(overrides = {}) {
  return {
    id: blockId('divider'),
    type: 'divider',
    color: '#ddd3c4',
    paddingTop: 12,
    paddingBottom: 12,
    ...overrides,
  };
}

function defaultBuilderBlocks() {
  return [
    createImageBlock(),
    createTextBlock({
      content: 'Upgrade your workflow today.\n\nWelcome to the future of email marketing. Our professional builder helps you create beautiful, high-converting emails in minutes, not hours.',
      fontSize: 18,
      paddingTop: 24,
      paddingBottom: 16,
    }),
    createButtonBlock({ label: 'Get started now', href: 'https://example.com/start' }),
  ];
}

function createEmptyCampaign() {
  const builderBlocks = defaultBuilderBlocks();

  return {
    name: '',
    subject: '',
    preview_text: '',
    builder_type: 'visual-blocks',
    template_html: buildTemplateHtml(builderBlocks),
    template_text: buildTemplateText(builderBlocks),
    selected_email_account_ids: [],
    audience_filters: { search: '', group_ids: [], tag_ids: [], status: 'active' },
    scheduled_at: '',
    settings: {
      builder_blocks: builderBlocks,
      builder_viewport: 'desktop',
    },
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

function sanitizeText(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildTemplateHtml(blocks) {
  const content = blocks
    .map((block) => {
      const commonPadding = `padding:${block.paddingTop ?? 0}px 0 ${block.paddingBottom ?? 0}px;`;

      if (block.type === 'text') {
        const html = sanitizeText(block.content).replace(/\n/g, '<br />');
        return `<div style="${commonPadding} text-align:${block.align || 'left'}; color:${block.color || '#201a16'}; font-size:${block.fontSize || 16}px; line-height:1.75;">${html}</div>`;
      }

      if (block.type === 'image') {
        return `<div style="${commonPadding}"><img src="${sanitizeText(block.src)}" alt="${sanitizeText(block.alt || '')}" style="display:block; width:100%; border:0; border-radius:18px;" /></div>`;
      }

      if (block.type === 'button') {
        return `<div style="${commonPadding} text-align:${block.align || 'left'};"><a href="${sanitizeText(block.href || '#')}" style="display:inline-block; background:${block.backgroundColor || '#171411'}; color:${block.textColor || '#fffaf3'}; text-decoration:none; padding:14px 24px; border-radius:14px; font-weight:700;">${sanitizeText(block.label || 'Call to action')}</a></div>`;
      }

      if (block.type === 'divider') {
        return `<div style="${commonPadding}"><hr style="border:none; border-top:1px solid ${block.color || '#ddd3c4'};" /></div>`;
      }

      return '';
    })
    .join('');

  return `<div style="max-width:640px;margin:0 auto;padding:24px;background:#fffaf3;font-family:Manrope,Arial,sans-serif;color:#201a16;">${content}</div>`;
}

function buildTemplateText(blocks) {
  return blocks
    .map((block) => {
      if (block.type === 'text') return block.content || '';
      if (block.type === 'button') return `${block.label || 'Call to action'}: ${block.href || ''}`.trim();
      if (block.type === 'divider') return '----------------';
      return '';
    })
    .filter(Boolean)
    .join('\n\n');
}

function ensureBuilderSettings(campaign) {
  const existingBlocks = campaign.settings?.builder_blocks;
  const blocks = Array.isArray(existingBlocks) && existingBlocks.length ? existingBlocks : defaultBuilderBlocks();

  return {
    ...campaign,
    builder_type: campaign.builder_type || 'visual-blocks',
    template_html: campaign.template_html || buildTemplateHtml(blocks),
    template_text: campaign.template_text || buildTemplateText(blocks),
    settings: {
      ...(campaign.settings || {}),
      builder_blocks: blocks,
      builder_viewport: campaign.settings?.builder_viewport || 'desktop',
    },
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

function EmailBlockCanvas({ blocks, selectedBlockId, onSelectBlock, viewport }) {
  return (
    <div className={`campaign-builder-canvas campaign-builder-canvas--${viewport}`}>
      <div className="campaign-builder-canvas__chrome">
        <span />
        <span />
        <span />
      </div>
      <div className="campaign-builder-canvas__body">
        {blocks.map((block) => {
          const selected = selectedBlockId === block.id;

          return (
            <button
              key={block.id}
              type="button"
              className={`campaign-email-block campaign-email-block--${block.type} ${selected ? 'campaign-email-block--selected' : ''}`}
              onClick={() => onSelectBlock(block.id)}
            >
              {block.type === 'image' ? <img src={block.src} alt={block.alt || 'Campaign visual'} className="campaign-email-block__image" /> : null}
              {block.type === 'text' ? (
                <div
                  className="campaign-email-block__text"
                  style={{ textAlign: block.align, color: block.color, fontSize: `${block.fontSize}px`, paddingTop: block.paddingTop, paddingBottom: block.paddingBottom }}
                >
                  {block.content.split('\n').map((line, index) => (
                    <p key={`${block.id}-${index}`}>{line}</p>
                  ))}
                </div>
              ) : null}
              {block.type === 'button' ? (
                <div className="campaign-email-block__button-shell" style={{ textAlign: block.align, paddingTop: block.paddingTop, paddingBottom: block.paddingBottom }}>
                  <span className="campaign-email-block__button" style={{ backgroundColor: block.backgroundColor, color: block.textColor }}>
                    {block.label}
                  </span>
                </div>
              ) : null}
              {block.type === 'divider' ? (
                <div className="campaign-email-block__divider-shell" style={{ paddingTop: block.paddingTop, paddingBottom: block.paddingBottom }}>
                  <span className="campaign-email-block__divider" style={{ backgroundColor: block.color }} />
                </div>
              ) : null}
            </button>
          );
        })}
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
  const [selectedBlockId, setSelectedBlockId] = useState(null);
  const [aiBrief, setAiBrief] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [detailsAiBusy, setDetailsAiBusy] = useState(false);
  const [detailsInsights, setDetailsInsights] = useState(null);
  const [wizardStep, setWizardStep] = useState(0);
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
  const builderBlocks = form.settings?.builder_blocks || [];
  const selectedBlock = builderBlocks.find((block) => block.id === selectedBlockId) || builderBlocks[0] || null;
  const builderTextSummary = buildTemplateText(builderBlocks);
  const liveCampaigns = campaigns.filter((campaign) => ['active', 'queued', 'scheduled', 'running'].includes(campaign.status)).length;
  const draftCampaigns = campaigns.filter((campaign) => campaign.status === 'draft').length;
  const scheduleMode = form.scheduled_at ? 'later' : 'now';

  function syncBuilder(nextBlocks, extraSettings = {}) {
    setForm((current) => ({
      ...current,
      builder_type: 'visual-blocks',
      template_html: buildTemplateHtml(nextBlocks),
      template_text: buildTemplateText(nextBlocks),
      settings: {
        ...(current.settings || {}),
        ...extraSettings,
        builder_blocks: nextBlocks,
      },
    }));
  }

  function openNewModal() {
    const nextCampaign = createEmptyCampaign();
    setEditingId(null);
    setForm(nextCampaign);
    setSelectedBlockId(nextCampaign.settings.builder_blocks[0]?.id ?? null);
    setWizardStep(0);
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

  function addBuilderBlock(type) {
    let newBlock = null;

    if (type === 'text') newBlock = createTextBlock();
    if (type === 'image') newBlock = createImageBlock();
    if (type === 'button') newBlock = createButtonBlock();
    if (type === 'divider') newBlock = createDividerBlock();

    if (!newBlock) return;

    const nextBlocks = [...builderBlocks, newBlock];
    syncBuilder(nextBlocks);
    setSelectedBlockId(newBlock.id);
  }

  function updateSelectedBlock(patch) {
    if (!selectedBlock) return;

    const nextBlocks = builderBlocks.map((block) => (block.id === selectedBlock.id ? { ...block, ...patch } : block));
    syncBuilder(nextBlocks);
  }

  function removeSelectedBlock() {
    if (!selectedBlock) return;

    const nextBlocks = builderBlocks.filter((block) => block.id !== selectedBlock.id);
    syncBuilder(nextBlocks.length ? nextBlocks : defaultBuilderBlocks());
    setSelectedBlockId(nextBlocks[0]?.id ?? null);
  }

  async function generateCampaignWithAi() {
    if (!aiBrief.trim()) {
      toast.error('Add a short campaign brief first');
      return;
    }

    setAiBusy(true);

    try {
      const response = await api.post('/api/campaigns/generate', {
        brief: aiBrief.trim(),
        campaign_name: form.name,
        subject: form.subject,
      });

      const draft = response.data?.draft;

      if (!draft) {
        throw new Error('No draft returned');
      }

      const blocks = draft.builder_blocks || [];

      setForm((current) => ({
        ...current,
        name: draft.name || current.name,
        subject: draft.subject || current.subject,
        preview_text: draft.preview_text ?? current.preview_text,
        builder_type: 'visual-blocks',
        template_html: buildTemplateHtml(blocks),
        template_text: buildTemplateText(blocks),
        settings: {
          ...(current.settings || {}),
          builder_blocks: blocks,
        },
        steps: (draft.steps || []).map((step) => ({
          ...step,
          id: step.id || `step-${crypto.randomUUID()}`,
        })),
      }));
      setSelectedBlockId(blocks[0]?.id ?? null);
      toast.success(`Campaign draft generated with ${response.data?.model || 'AI'}`);
    } catch (error) {
      toast.error(error.payload?.message || error.message || 'Could not generate campaign draft');
    } finally {
      setAiBusy(false);
    }
  }

  async function assistCampaignDetailsWithAi() {
    setDetailsAiBusy(true);

    try {
      const response = await api.post('/api/campaigns/assist-details', {
        brief: aiBrief.trim(),
        campaign_name: form.name,
        subject: form.subject,
        preview_text: form.preview_text,
        builder_text: builderTextSummary,
      });

      const details = response.data?.details;

      if (!details) {
        throw new Error('No detail suggestions returned');
      }

      setDetailsInsights(details);
      setForm((current) => ({
        ...current,
        name: details.campaign_name || current.name,
        subject: details.subject || current.subject,
        preview_text: details.preview_text || current.preview_text,
      }));
      toast.success(`Details refined with ${response.data?.model || 'AI'}`);
    } catch (error) {
      toast.error(error.payload?.message || error.message || 'Could not refine campaign details');
    } finally {
      setDetailsAiBusy(false);
    }
  }

  async function saveCampaign(event) {
    event.preventDefault();

    const payload = {
      ...form,
      builder_type: 'visual-blocks',
      template_html: buildTemplateHtml(builderBlocks),
      template_text: buildTemplateText(builderBlocks),
      scheduled_at: form.scheduled_at || null,
      steps: orderedSteps,
    };

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
      setSelectedBlockId(null);
      setWizardStep(0);
      load();
    } catch (error) {
      toast.error(error.payload?.message || 'Could not save campaign');
    }
  }

  async function startEdit(id) {
    try {
      const response = await api.get(`/api/campaigns/${id}`);
      const campaign = ensureBuilderSettings(response.data);
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
      setSelectedBlockId(campaign.settings.builder_blocks[0]?.id ?? null);
      setWizardStep(0);
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
        onClose={() => {
          setModalOpen(false);
          setWizardStep(0);
        }}
        width="max-w-[1500px]"
      >
        <form id="campaign-form" className="space-y-6" onSubmit={saveCampaign}>
          <section className="surface-card-muted p-4 sm:p-5">
            <div className="campaign-wizard">
              {CAMPAIGN_WIZARD_STEPS.map((step, index) => (
                <button
                  key={step.id}
                  type="button"
                  className={`campaign-wizard__step ${wizardStep === index ? 'campaign-wizard__step--active' : ''} ${wizardStep > index ? 'campaign-wizard__step--complete' : ''}`}
                  onClick={() => setWizardStep(index)}
                >
                  <span className="campaign-wizard__index">{index + 1}</span>
                  <span className="campaign-wizard__copy">
                    <strong>{step.label}</strong>
                    <small>{step.description}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>

          {wizardStep === 0 ? (
            <section className="surface-card-muted p-4 sm:p-5">
              <div className="flex flex-col gap-4 border-b border-slate-200 pb-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <p className="eyebrow !text-[0.64rem] !tracking-[0.24em]">Step 1</p>
                    <h3 className="mt-2 text-2xl font-semibold text-slate-950">Build the opening email first.</h3>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                      Start with the core email. Once the layout and message are ready, move to campaign details, audience, scheduling, and follow-up flow.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      className={`ghost-button ${form.settings?.builder_viewport !== 'desktop' ? '!bg-transparent' : ''}`}
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, settings: { ...(current.settings || {}), builder_viewport: 'desktop' } }))}
                    >
                      <Monitor size={16} />
                      Desktop
                    </button>
                    <button
                      className={`ghost-button ${form.settings?.builder_viewport !== 'mobile' ? '!bg-transparent' : ''}`}
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, settings: { ...(current.settings || {}), builder_viewport: 'mobile' } }))}
                    >
                      <Smartphone size={16} />
                      Mobile
                    </button>
                  </div>
                </div>

                <div className="campaign-ai-bar">
                  <label className="field-shell campaign-ai-bar__input">
                    <span className="field-label">AI campaign brief</span>
                    <textarea
                      className="field-input min-h-24"
                      value={aiBrief}
                      onChange={(event) => setAiBrief(event.target.value)}
                      placeholder="Describe the offer, audience, tone, CTA, and any angle you want. Example: generate a cold outbound campaign for a B2B email warmup tool targeting SaaS founders."
                    />
                  </label>
                  <div className="campaign-ai-bar__actions">
                    <p className="text-sm leading-6 text-slate-500">
                      AI can draft the campaign name, subject, preview text, builder blocks, and follow-up steps. You can refine everything before moving on.
                    </p>
                    <button className="primary-button" type="button" onClick={generateCampaignWithAi} disabled={aiBusy}>
                      <Sparkles size={16} />
                      {aiBusy ? 'Generating...' : 'Generate with AI'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="campaign-builder-shell mt-5">
                <aside className="campaign-builder-sidebar">
                  <div>
                    <p className="campaign-builder-sidebar__label">Content blocks</p>
                    <div className="campaign-builder-module-grid">
                      {BUILDER_MODULES.map((module) => {
                        const Icon = module.icon;

                        return (
                          <button key={module.type} type="button" className="campaign-builder-module" onClick={() => addBuilderBlock(module.type)}>
                            <Icon size={17} />
                            <span>{module.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="campaign-builder-sidebar__panel">
                    <p className="campaign-builder-sidebar__label">Saved modules</p>
                    <div className="campaign-builder-sidebar__empty">No saved modules yet.</div>
                  </div>

                  <div className="campaign-builder-sidebar__panel">
                    <p className="campaign-builder-sidebar__label">Personalization</p>
                    <div className="flex flex-wrap gap-2">
                      {PLACEHOLDER_TOKENS.map((token) => (
                        <span key={token} className="status-badge status-badge--slate">
                          {token}
                        </span>
                      ))}
                    </div>
                  </div>
                </aside>

                <div className="campaign-builder-stage">
                  <EmailBlockCanvas
                    blocks={builderBlocks}
                    selectedBlockId={selectedBlock?.id || null}
                    onSelectBlock={setSelectedBlockId}
                    viewport={form.settings?.builder_viewport || 'desktop'}
                  />
                  <div className="campaign-builder-dropzone">
                    <Plus size={16} />
                    <span>Add another block from the left</span>
                  </div>
                </div>

                <aside className="campaign-builder-sidebar">
                  <div className="campaign-builder-sidebar__panel">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <p className="campaign-builder-sidebar__label">Properties</p>
                        <h4 className="mt-2 text-lg font-semibold text-slate-950">
                          {selectedBlock ? `${selectedBlock.type[0].toUpperCase()}${selectedBlock.type.slice(1)} block` : 'Select a block'}
                        </h4>
                      </div>
                      {selectedBlock ? (
                        <button className="ghost-button !p-3" type="button" onClick={removeSelectedBlock}>
                          <Trash2 size={16} />
                        </button>
                      ) : null}
                    </div>

                    {selectedBlock ? (
                      <div className="space-y-3">
                        {selectedBlock.type === 'text' ? (
                          <>
                            <label className="field-shell">
                              <span className="field-label">Text content</span>
                              <textarea className="field-input min-h-40" value={selectedBlock.content} onChange={(event) => updateSelectedBlock({ content: event.target.value })} />
                            </label>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="field-shell">
                                <span className="field-label">Font size</span>
                                <input className="field-input" type="number" min="12" max="28" value={selectedBlock.fontSize} onChange={(event) => updateSelectedBlock({ fontSize: Number(event.target.value) })} />
                              </label>
                              <label className="field-shell">
                                <span className="field-label">Text color</span>
                                <input className="field-input" type="color" value={selectedBlock.color} onChange={(event) => updateSelectedBlock({ color: event.target.value })} />
                              </label>
                            </div>
                            <div className="campaign-aligner">
                              <button type="button" className={`ghost-button ${selectedBlock.align === 'left' ? 'campaign-aligner__button--active' : ''}`} onClick={() => updateSelectedBlock({ align: 'left' })}>
                                <AlignLeft size={16} />
                              </button>
                              <button type="button" className={`ghost-button ${selectedBlock.align === 'center' ? 'campaign-aligner__button--active' : ''}`} onClick={() => updateSelectedBlock({ align: 'center' })}>
                                <AlignCenter size={16} />
                              </button>
                              <button type="button" className={`ghost-button ${selectedBlock.align === 'right' ? 'campaign-aligner__button--active' : ''}`} onClick={() => updateSelectedBlock({ align: 'right' })}>
                                <AlignRight size={16} />
                              </button>
                            </div>
                          </>
                        ) : null}

                        {selectedBlock.type === 'image' ? (
                          <>
                            <label className="field-shell">
                              <span className="field-label">Image URL</span>
                              <input className="field-input" value={selectedBlock.src} onChange={(event) => updateSelectedBlock({ src: event.target.value })} />
                            </label>
                            <label className="field-shell">
                              <span className="field-label">Alt text</span>
                              <input className="field-input" value={selectedBlock.alt} onChange={(event) => updateSelectedBlock({ alt: event.target.value })} />
                            </label>
                          </>
                        ) : null}

                        {selectedBlock.type === 'button' ? (
                          <>
                            <label className="field-shell">
                              <span className="field-label">Button label</span>
                              <input className="field-input" value={selectedBlock.label} onChange={(event) => updateSelectedBlock({ label: event.target.value })} />
                            </label>
                            <label className="field-shell">
                              <span className="field-label">Link target</span>
                              <input className="field-input" value={selectedBlock.href} onChange={(event) => updateSelectedBlock({ href: event.target.value })} />
                            </label>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="field-shell">
                                <span className="field-label">Button color</span>
                                <input className="field-input" type="color" value={selectedBlock.backgroundColor} onChange={(event) => updateSelectedBlock({ backgroundColor: event.target.value })} />
                              </label>
                              <label className="field-shell">
                                <span className="field-label">Text color</span>
                                <input className="field-input" type="color" value={selectedBlock.textColor} onChange={(event) => updateSelectedBlock({ textColor: event.target.value })} />
                              </label>
                            </div>
                            <div className="campaign-aligner">
                              <button type="button" className={`ghost-button ${selectedBlock.align === 'left' ? 'campaign-aligner__button--active' : ''}`} onClick={() => updateSelectedBlock({ align: 'left' })}>
                                <AlignLeft size={16} />
                              </button>
                              <button type="button" className={`ghost-button ${selectedBlock.align === 'center' ? 'campaign-aligner__button--active' : ''}`} onClick={() => updateSelectedBlock({ align: 'center' })}>
                                <AlignCenter size={16} />
                              </button>
                              <button type="button" className={`ghost-button ${selectedBlock.align === 'right' ? 'campaign-aligner__button--active' : ''}`} onClick={() => updateSelectedBlock({ align: 'right' })}>
                                <AlignRight size={16} />
                              </button>
                            </div>
                          </>
                        ) : null}

                        {selectedBlock.type === 'divider' ? (
                          <label className="field-shell">
                            <span className="field-label">Divider color</span>
                            <input className="field-input" type="color" value={selectedBlock.color} onChange={(event) => updateSelectedBlock({ color: event.target.value })} />
                          </label>
                        ) : null}

                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="field-shell">
                            <span className="field-label">Padding top</span>
                            <input className="field-input" type="number" min="0" max="80" value={selectedBlock.paddingTop ?? 0} onChange={(event) => updateSelectedBlock({ paddingTop: Number(event.target.value) })} />
                          </label>
                          <label className="field-shell">
                            <span className="field-label">Padding bottom</span>
                            <input className="field-input" type="number" min="0" max="80" value={selectedBlock.paddingBottom ?? 0} onChange={(event) => updateSelectedBlock({ paddingBottom: Number(event.target.value) })} />
                          </label>
                        </div>
                      </div>
                    ) : (
                      <div className="campaign-builder-sidebar__empty">Choose a block on the canvas to edit its content and layout.</div>
                    )}
                  </div>
                </aside>
              </div>
            </section>
          ) : null}

          {wizardStep === 1 ? (
            <section className="campaign-details-shell">
              <div className="campaign-details-main">
                <div className="surface-card-muted p-5">
                  <div className="campaign-details-header">
                    <div>
                      <p className="eyebrow !text-[0.64rem] !tracking-[0.24em]">Step 2</p>
                      <h3 className="mt-2 text-2xl font-semibold text-slate-950">Campaign details</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-500">Set the campaign name, email copy, recipients, and delivery timing.</p>
                    </div>
                    <button className="primary-button" type="button" onClick={assistCampaignDetailsWithAi} disabled={detailsAiBusy}>
                      <Sparkles size={16} />
                      {detailsAiBusy ? 'Refining...' : 'Refine with AI'}
                    </button>
                  </div>
                </div>

                <div className="surface-card-muted p-5">
                  <div className="campaign-details-grid">
                    <label className="field-shell campaign-details-grid__wide">
                      <span className="field-label">Campaign name</span>
                      <input className="field-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                    </label>
                    <label className="field-shell">
                      <span className="field-label">Subject line</span>
                      <input className="field-input" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} />
                      <span className="text-xs text-slate-400">{form.subject.length}/255</span>
                    </label>
                    <label className="field-shell">
                      <span className="field-label">Preview text</span>
                      <textarea className="field-input min-h-24" value={form.preview_text} onChange={(event) => setForm({ ...form, preview_text: event.target.value })} />
                      <span className="text-xs text-slate-400">{form.preview_text.length}/255</span>
                    </label>
                  </div>
                </div>

                <div className="campaign-details-grid">
                  <div className="surface-card-muted p-5">
                    <p className="eyebrow !text-[0.64rem] !tracking-[0.24em]">Senders</p>
                    <label className="field-shell mt-4">
                      <span className="field-label">Sender mailbox pool</span>
                      <select
                        className="field-input campaign-multi-select"
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
                  </div>

                  <div className="surface-card-muted p-5">
                    <p className="eyebrow !text-[0.64rem] !tracking-[0.24em]">Recipients</p>
                    <div className="mt-4 grid gap-4">
                      <label className="field-shell">
                        <span className="field-label">Tag segments</span>
                        <select
                          className="field-input campaign-multi-select"
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
                          className="field-input campaign-multi-select"
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
                  </div>
                </div>

                <div className="surface-card-muted p-5">
                  <p className="eyebrow !text-[0.64rem] !tracking-[0.24em]">Delivery</p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <button
                      type="button"
                      className={`campaign-choice-card ${scheduleMode === 'now' ? 'campaign-choice-card--active' : ''}`}
                      onClick={() => setForm({ ...form, scheduled_at: '' })}
                    >
                      <strong>Send now</strong>
                      <span>Launch immediately.</span>
                    </button>
                    <button
                      type="button"
                      className={`campaign-choice-card ${scheduleMode === 'later' ? 'campaign-choice-card--active' : ''}`}
                      onClick={() => !form.scheduled_at && setForm({ ...form, scheduled_at: new Date().toISOString().slice(0, 16) })}
                    >
                      <strong>Schedule</strong>
                      <span>Choose a future time.</span>
                    </button>
                  </div>
                  {scheduleMode === 'later' ? (
                    <label className="field-shell mt-4">
                      <span className="field-label">Send time</span>
                      <input className="field-input" type="datetime-local" value={form.scheduled_at} onChange={(event) => setForm({ ...form, scheduled_at: event.target.value })} />
                    </label>
                  ) : null}
                </div>
              </div>

              <aside className="campaign-details-side">
                <div className="surface-card-muted p-5">
                  <p className="eyebrow !text-[0.64rem] !tracking-[0.24em]">Snapshot</p>
                  <div className="mt-4 space-y-3">
                    <div className="campaign-summary-tile"><span>Name</span><strong>{form.name || 'Untitled campaign'}</strong></div>
                    <div className="campaign-summary-tile"><span>Subject</span><strong>{form.subject || 'No subject yet'}</strong></div>
                    <div className="campaign-summary-tile"><span>Mailboxes</span><strong>{form.selected_email_account_ids.length}</strong></div>
                    <div className="campaign-summary-tile"><span>Recipients</span><strong>{form.audience_filters.tag_ids.length + form.audience_filters.group_ids.length}</strong></div>
                    <div className="campaign-summary-tile"><span>Delivery</span><strong>{scheduleMode === 'later' ? form.scheduled_at : 'Send immediately'}</strong></div>
                  </div>
                </div>

                <div className="surface-card-muted p-5">
                  <p className="eyebrow !text-[0.64rem] !tracking-[0.24em]">Checks</p>
                  <div className="mt-4 space-y-3">
                    <div className="campaign-summary-tile"><span>Subject</span><strong>{form.subject.length > 0 && form.subject.length <= 60 ? 'Healthy' : 'Needs work'}</strong></div>
                    <div className="campaign-summary-tile"><span>Preview</span><strong>{form.preview_text.length > 0 && form.preview_text.length <= 120 ? 'Healthy' : 'Needs work'}</strong></div>
                    <div className="campaign-summary-tile"><span>AI note</span><strong>{detailsInsights?.quality_note || 'No note yet'}</strong></div>
                  </div>
                </div>

                {detailsInsights ? (
                  <div className="surface-card-muted p-5">
                    <p className="eyebrow !text-[0.64rem] !tracking-[0.24em]">AI suggestions</p>
                    <div className="mt-4 space-y-3">
                      <div className="campaign-summary-tile"><span>Audience</span><strong>{detailsInsights.audience_strategy || 'No suggestion yet'}</strong></div>
                      <div className="campaign-summary-tile"><span>Send plan</span><strong>{detailsInsights.send_strategy || 'No suggestion yet'}</strong></div>
                    </div>
                  </div>
                ) : null}
              </aside>
            </section>
          ) : null}

          {wizardStep === 2 ? (
            <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-4">
                <div className="surface-card-muted p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="eyebrow !text-[0.64rem] !tracking-[0.24em]">Step 3</p>
                      <h3 className="mt-2 text-2xl font-semibold text-slate-950">Finalize the follow-up flow</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        Add the remaining step copy, delays, and sequencing rules before saving the campaign.
                      </p>
                    </div>
                    <button className="ghost-button" type="button" onClick={addStep}>
                      <MailPlus size={16} />
                      Add step
                    </button>
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
                        The visual builder controls the main campaign email. Each sequence step still keeps its own HTML body so follow-ups can stay shorter and more direct.
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

              <div className="space-y-4">
                <div className="surface-card-muted p-5">
                  <p className="eyebrow !text-[0.64rem] !tracking-[0.24em]">Launch readiness</p>
                  <h3 className="mt-2 text-2xl font-semibold text-slate-950">Final checklist</h3>
                  <div className="mt-4 space-y-3">
                    <div className="campaign-summary-tile"><span>Campaign</span><strong>{form.name || 'Untitled campaign'}</strong></div>
                    <div className="campaign-summary-tile"><span>Subject</span><strong>{form.subject || 'No subject yet'}</strong></div>
                    <div className="campaign-summary-tile"><span>Opening blocks</span><strong>{builderBlocks.length}</strong></div>
                    <div className="campaign-summary-tile"><span>Sequence steps</span><strong>{orderedSteps.length}</strong></div>
                    <div className="campaign-summary-tile"><span>Scheduled at</span><strong>{form.scheduled_at || 'Send immediately when launched'}</strong></div>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          <section className="surface-card-muted p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-500">
                Step {wizardStep + 1} of {CAMPAIGN_WIZARD_STEPS.length}: {CAMPAIGN_WIZARD_STEPS[wizardStep].label}
              </div>
              <div className="flex flex-wrap justify-end gap-3">
                <button className="ghost-button" type="button" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                {wizardStep > 0 ? (
                  <button className="ghost-button" type="button" onClick={() => setWizardStep((current) => Math.max(current - 1, 0))}>
                    Back
                  </button>
                ) : null}
                {wizardStep < CAMPAIGN_WIZARD_STEPS.length - 1 ? (
                  <button className="primary-button" type="button" onClick={() => setWizardStep((current) => Math.min(current + 1, CAMPAIGN_WIZARD_STEPS.length - 1))}>
                    Next step
                  </button>
                ) : (
                  <button className="primary-button" type="submit">
                    {editingId ? 'Save campaign' : 'Create campaign'}
                  </button>
                )}
              </div>
            </div>
          </section>
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
