import { useEffect, useMemo, useState } from 'react';
import { Download, Plus, Search, Upload, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '../components/Modal';
import { MetricCard } from '../components/MetricCard';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { api } from '../lib/api';

function createEmptyContact() {
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
    tags: '',
    groups: '',
  };
}

export function ContactsPage() {
  const [payload, setPayload] = useState(null);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(createEmptyContact());
  const [editingId, setEditingId] = useState(null);

  const contacts = useMemo(() => payload?.data || [], [payload]);
  const activeContacts = useMemo(() => contacts.filter((contact) => contact.status === 'active').length, [contacts]);
  const taggedContacts = useMemo(() => contacts.filter((contact) => contact.tags?.length).length, [contacts]);

  async function loadContacts(query = '') {
    const response = await api.get(`/api/contacts${query ? `?search=${encodeURIComponent(query)}` : ''}`);
    setPayload(response);
  }

  useEffect(() => {
    loadContacts().catch(() => toast.error('Could not load contacts'));
  }, []);

  async function handleSave(event) {
    event.preventDefault();

    const body = {
      ...form,
      tags: form.tags
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      groups: form.groups
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    };

    try {
      if (editingId) {
        await api.put(`/api/contacts/${editingId}`, body);
        toast.success('Contact updated');
      } else {
        await api.post('/api/contacts', body);
        toast.success('Contact created');
      }

      setModalOpen(false);
      setForm(createEmptyContact());
      setEditingId(null);
      loadContacts(search);
    } catch (error) {
      toast.error(error.payload?.message || 'Could not save contact');
    }
  }

  function openNewModal() {
    setEditingId(null);
    setForm(createEmptyContact());
    setModalOpen(true);
  }

  function startEdit(contact) {
    setEditingId(contact.id);
    setForm({
      ...contact,
      tags: (contact.tags || []).map((tag) => tag.name).join(', '),
      groups: (contact.groups || []).map((group) => group.name).join(', '),
    });
    setModalOpen(true);
  }

  async function destroyContact(id) {
    try {
      await api.delete(`/api/contacts/${id}`);
      toast.success('Contact removed');
      loadContacts(search);
    } catch {
      toast.error('Could not delete contact');
    }
  }

  async function handleImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.post('/api/contacts/import', formData);
      toast.success('Contacts imported');
      loadContacts(search);
    } catch {
      toast.error('CSV import failed');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Contact management"
        title="Keep prospect lists structured, searchable, and ready for outbound."
        description="Manage imports, group contacts into reusable segments, and keep tags clean so campaign targeting stays precise."
        stats={[
          { label: 'All contacts', value: contacts.length },
          { label: 'Active', value: activeContacts },
          { label: 'Tagged', value: taggedContacts },
        ]}
        actions={
          <>
            <label className="ghost-button cursor-pointer">
              <Upload size={16} />
              <span>Import CSV</span>
              <input hidden type="file" accept=".csv,text/csv" onChange={handleImport} />
            </label>
            <a className="ghost-button" href="/api/contacts/export">
              <Download size={16} />
              <span>Export CSV</span>
            </a>
            <button className="primary-button" type="button" onClick={openNewModal}>
              <Plus size={16} />
              <span>Add contact</span>
            </button>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Prospects" value={contacts.length} hint="Visible records" icon={Users} tone="blue" />
        <MetricCard
          label="Segments"
          value={`${payload?.filters?.groups?.length || 0}`}
          hint="Saved groups"
          tone="emerald"
        />
        <MetricCard
          label="Tags"
          value={`${payload?.filters?.tags?.length || 0}`}
          hint="Reusable labels"
          tone="amber"
        />
      </section>

      <section className="surface-card p-5 sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="eyebrow !text-[0.64rem] !tracking-[0.24em]">Search and segment</p>
            <h2 className="text-2xl font-semibold text-slate-950">Filter the live prospect list</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {(payload?.filters?.tags || []).slice(0, 5).map((tag) => (
              <span key={tag.id} className="status-badge status-badge--slate">
                {tag.name}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4 xl:flex-row xl:items-center">
          <label className="search-shell max-w-2xl flex-1">
            <Search size={16} className="text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && loadContacts(search)}
              className="w-full bg-transparent text-sm text-slate-900 outline-none"
              placeholder="Search by email, name, company, or title"
            />
          </label>
          <button className="ghost-button" type="button" onClick={() => loadContacts(search)}>
            Search
          </button>
        </div>
      </section>

      <section className="surface-card table-shell">
        <div className="overflow-x-auto">
          <table className="data-table min-w-[920px] text-left">
            <thead>
              <tr>
                <th>Prospect</th>
                <th>Company</th>
                <th>Status</th>
                <th>Tags</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {contacts.length ? (
                contacts.map((contact) => (
                  <tr key={contact.id}>
                    <td>
                      <div className="font-semibold text-slate-950">{contact.full_name}</div>
                      <div className="mt-1 text-sm text-slate-500">{contact.email}</div>
                    </td>
                    <td>
                      <div className="font-medium text-slate-700">{contact.company || 'No company'}</div>
                      <div className="mt-1 text-sm text-slate-500">{contact.job_title || 'No title'}</div>
                    </td>
                    <td>
                      <StatusBadge status={contact.status} />
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        {contact.tags?.length ? (
                          contact.tags.map((tag) => (
                            <span
                              key={tag.id}
                              className="rounded-full px-3 py-1 text-xs font-semibold text-slate-700"
                              style={{ backgroundColor: `${tag.color}22` }}
                            >
                              {tag.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-slate-400">No tags</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="flex justify-end gap-2">
                        <button className="ghost-button" type="button" onClick={() => startEdit(contact)}>
                          Edit
                        </button>
                        <button className="ghost-button" type="button" onClick={() => destroyContact(contact.id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5">
                    <div className="empty-panel m-4 p-6 text-center text-sm">
                      No contacts matched the current search.
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
        title={editingId ? 'Edit contact' : 'Add contact'}
        onClose={() => setModalOpen(false)}
        footer={
          <div className="flex justify-end gap-3">
            <button className="ghost-button" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button className="primary-button" type="submit" form="contact-form">
              {editingId ? 'Save changes' : 'Create contact'}
            </button>
          </div>
        }
      >
        <form id="contact-form" className="grid gap-4 md:grid-cols-2" onSubmit={handleSave}>
          {[
            ['first_name', 'First name'],
            ['last_name', 'Last name'],
            ['email', 'Email'],
            ['company', 'Company'],
            ['job_title', 'Job title'],
            ['phone', 'Phone'],
            ['website', 'Website'],
            ['location', 'Location'],
          ].map(([key, label]) => (
            <label key={key} className="field-shell">
              <span className="field-label">{label}</span>
              <input className="field-input" value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />
            </label>
          ))}

          <label className="field-shell">
            <span className="field-label">Status</span>
            <select className="field-input" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="unsubscribed">Unsubscribed</option>
            </select>
          </label>

          <div className="surface-card-muted rounded-[22px] p-4">
            <p className="text-sm font-semibold text-slate-950">Segmentation tips</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Use tags for short attributes such as ICP, intent, or source. Use groups for reusable campaign audiences.
            </p>
          </div>

          <label className="field-shell md:col-span-2">
            <span className="field-label">Tags (comma separated)</span>
            <input className="field-input" value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} />
          </label>
          <label className="field-shell md:col-span-2">
            <span className="field-label">Groups (comma separated)</span>
            <input className="field-input" value={form.groups} onChange={(event) => setForm({ ...form, groups: event.target.value })} />
          </label>
          <label className="field-shell md:col-span-2">
            <span className="field-label">Notes</span>
            <textarea className="field-input min-h-28" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
          </label>
        </form>
      </Modal>
    </div>
  );
}
