import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Inbox, Search, Send } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { RichTextEditor } from '../components/RichTextEditor';
import { api } from '../lib/api';

const inboxFilters = [
  { id: 'all', label: 'All threads' },
  { id: 'needs_reply', label: 'Needs reply' },
  { id: 'replied', label: 'Replied' },
  { id: 'bounced', label: 'Bounced' },
];

function createReplyForm(subject = '') {
  return {
    subject,
    body_html: '<p></p>',
    body_text: '',
  };
}

function formatDateTime(value) {
  if (!value) {
    return 'Pending';
  }

  return new Date(value).toLocaleString();
}

function previewText(message) {
  return message?.body_text || message?.body_preview || 'No message body available yet.';
}

function threadPreview(thread) {
  return previewText(thread.latest_inbound_message || thread.latest_message);
}

function threadFilterMatches(thread, filterId) {
  if (filterId === 'all') {
    return true;
  }

  if (filterId === 'needs_reply') {
    return Boolean(thread.latest_inbound_message) && thread.status !== 'attention';
  }

  if (filterId === 'replied') {
    return thread.status === 'open' && Boolean(thread.latest_inbound_message);
  }

  if (filterId === 'bounced') {
    return thread.status === 'attention'
      || thread.latest_inbound_message?.event_type === 'bounced'
      || thread.messages?.some((message) => message.event_type === 'bounced');
  }

  return true;
}

function threadSearchMatches(thread, query) {
  if (!query) {
    return true;
  }

  const haystack = [
    thread.subject,
    thread.contact?.name,
    thread.contact?.email,
    thread.campaign?.name,
    thread.latest_inbound_message?.subject,
    thread.latest_inbound_message?.body_text,
    thread.latest_inbound_message?.body_preview,
    thread.latest_message?.subject,
    thread.latest_message?.body_text,
    thread.latest_message?.body_preview,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(query);
}

function sortMessages(messages) {
  return [...(messages || [])].sort((left, right) => {
    const leftTime = left?.sent_at ? new Date(left.sent_at).getTime() : 0;
    const rightTime = right?.sent_at ? new Date(right.sent_at).getTime() : 0;

    return leftTime - rightTime;
  });
}

export function ConversationsPage() {
  const location = useLocation();
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [replyForm, setReplyForm] = useState(createReplyForm());
  const [sendingReply, setSendingReply] = useState(false);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  async function loadThreads(preferredThreadId = null) {
    setLoadingThreads(true);

    try {
      const response = await api.get('/api/conversations');
      const items = response.data || [];

      startTransition(() => {
        setThreads(items);
      });

      const nextThread = preferredThreadId
        ? items.find((thread) => String(thread.id) === String(preferredThreadId)) || items[0] || null
        : items[0] || null;

      startTransition(() => {
        setActiveThreadId(nextThread?.id ?? null);
        setReplyForm(createReplyForm(nextThread?.subject || ''));
      });
    } finally {
      setLoadingThreads(false);
    }
  }

  useEffect(() => {
    loadThreads(location.state?.threadId || null).catch(() => toast.error('Could not load reply threads'));
  }, []);

  const filteredThreads = useMemo(
    () => threads
      .filter((thread) => threadFilterMatches(thread, activeFilter))
      .filter((thread) => threadSearchMatches(thread, deferredSearch)),
    [threads, activeFilter, deferredSearch],
  );

  const activeThread = useMemo(() => {
    const selected = filteredThreads.find((thread) => String(thread.id) === String(activeThreadId));

    if (selected) {
      return selected;
    }

    return filteredThreads[0] || null;
  }, [filteredThreads, activeThreadId]);

  const orderedMessages = useMemo(
    () => sortMessages(activeThread?.messages || []),
    [activeThread],
  );

  const inboxStats = useMemo(() => ({
    total: threads.length,
    needsReply: threads.filter((thread) => threadFilterMatches(thread, 'needs_reply')).length,
    bounced: threads.filter((thread) => threadFilterMatches(thread, 'bounced')).length,
  }), [threads]);

  useEffect(() => {
    if (!activeThread) {
      return;
    }

    if (String(activeThread.id) !== String(activeThreadId)) {
      startTransition(() => {
        setActiveThreadId(activeThread.id);
        setReplyForm(createReplyForm(activeThread.subject || ''));
      });
    }
  }, [activeThread, activeThreadId]);

  function selectThread(thread) {
    startTransition(() => {
      setActiveThreadId(thread.id);
      setReplyForm(createReplyForm(thread.subject || ''));
    });
  }

  async function handleReply(event) {
    event.preventDefault();

    if (!activeThread) {
      return;
    }

    setSendingReply(true);

    try {
      const response = await api.post(`/api/conversations/${activeThread.id}/reply`, replyForm);
      const updated = response.data || null;

      startTransition(() => {
        setThreads((current) => current.map((thread) => (
          String(thread.id) === String(updated.id) ? updated : thread
        )));
        setActiveThreadId(updated.id);
        setReplyForm(createReplyForm(updated?.subject || activeThread.subject || ''));
      });

      toast.success('Reply sent');
    } catch (error) {
      const firstError = Object.values(error.payload?.errors || {})?.[0]?.[0];
      toast.error(firstError || error.payload?.message || error.message || 'Could not send reply');
    } finally {
      setSendingReply(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Replies Inbox"
        title="Work incoming replies like an operator inbox."
        description="Search active conversations, isolate the threads that need attention, and answer from one focused workspace without losing campaign context."
        stats={[
          { label: 'Threads', value: inboxStats.total },
          { label: 'Needs reply', value: inboxStats.needsReply },
          { label: 'Bounces', value: inboxStats.bounced },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <section className="surface-card overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                <Inbox size={18} />
              </div>
              <div>
                <p className="eyebrow !text-[0.64rem] !tracking-[0.24em]">Inbox</p>
                <h2 className="text-2xl font-semibold text-slate-950">Reply threads</h2>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <label className="search-shell">
                <Search size={16} className="text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full bg-transparent text-sm text-slate-900 outline-none"
                  placeholder="Search email, contact, subject, or reply text"
                />
              </label>

              <div className="flex flex-wrap gap-2">
                {inboxFilters.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    className={`ghost-button ${activeFilter === filter.id ? '!border-blue-200 !bg-blue-50 !text-blue-700' : ''}`}
                    onClick={() => setActiveFilter(filter.id)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="max-h-[calc(100vh-15rem)] overflow-y-auto divide-y divide-slate-200">
            {filteredThreads.length ? (
              filteredThreads.map((thread) => {
                const selected = String(activeThread?.id) === String(thread.id);
                const inbound = thread.latest_inbound_message;

                return (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => selectThread(thread)}
                    className={`w-full px-5 py-4 text-left transition sm:px-6 ${selected ? 'bg-blue-50/80' : 'hover:bg-slate-50'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-slate-950">{thread.contact?.name || thread.subject}</h3>
                        <p className="mt-1 truncate text-sm text-slate-500">{thread.contact?.email}</p>
                      </div>
                      <StatusBadge status={thread.status} />
                    </div>

                    <div className="mt-3 rounded-[18px] bg-white/70 px-3 py-3 text-sm text-slate-600">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {inbound ? 'Latest inbound' : 'Latest activity'}
                      </p>
                      <p className="mt-2 line-clamp-3 whitespace-pre-wrap">{threadPreview(thread)}</p>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.16em] text-slate-400">
                      <span>{thread.campaign?.name || 'Direct conversation'}</span>
                      <span>{formatDateTime(inbound?.sent_at || thread.last_message_at)}</span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-6">
                <div className="empty-panel p-6 text-center text-sm">
                  {loadingThreads ? 'Loading reply threads...' : 'No reply threads match the current filters.'}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="surface-card p-5 sm:p-6">
          {activeThread ? (
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="eyebrow !text-[0.64rem] !tracking-[0.24em]">Selected thread</p>
                    <h2 className="mt-2 text-3xl font-semibold text-slate-950">{activeThread.subject}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {activeThread.contact?.name || 'Unknown contact'} / {activeThread.contact?.email || 'No email'}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Source: {activeThread.campaign?.name || 'Direct conversation'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={activeThread.status} />
                    <div className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {orderedMessages.length} messages
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-4">
                  {orderedMessages.length ? (
                    orderedMessages.map((message) => (
                      <div
                        key={message.id}
                        className={`rounded-[24px] border px-4 py-4 sm:px-5 ${
                          message.direction === 'inbound'
                            ? 'border-emerald-200 bg-emerald-50/80'
                            : 'border-slate-200 bg-blue-50/70'
                        }`}
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge
                              status={message.direction === 'inbound' ? 'reply received' : 'message sent'}
                              tone={message.direction === 'inbound' ? 'emerald' : 'blue'}
                            />
                            <StatusBadge status={message.event_type} />
                          </div>
                          <span className="text-sm text-slate-500">{formatDateTime(message.sent_at)}</span>
                        </div>

                        <h3 className="mt-3 text-lg font-semibold text-slate-950">{message.subject || 'No subject'}</h3>
                        <p className="mt-2 text-sm text-slate-500">
                          {message.sender_email || 'Unknown sender'} to {message.recipient_email || 'Unknown recipient'}
                        </p>
                        <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                          {previewText(message)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="empty-panel p-6 text-center text-sm">
                      No timeline is available for this thread yet.
                    </div>
                  )}
                </div>

                <aside className="space-y-4">
                  <div className="surface-card-muted rounded-[24px] p-4">
                    <p className="eyebrow !text-[0.62rem] !tracking-[0.22em]">Latest inbound reply</p>
                    {activeThread.latest_inbound_message ? (
                      <>
                        <h3 className="mt-3 text-lg font-semibold text-slate-950">
                          {activeThread.latest_inbound_message.subject || 'No subject'}
                        </h3>
                        <p className="mt-2 text-sm text-slate-500">
                          {formatDateTime(activeThread.latest_inbound_message.sent_at)}
                        </p>
                        <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                          {previewText(activeThread.latest_inbound_message)}
                        </p>
                      </>
                    ) : (
                      <p className="mt-3 text-sm leading-6 text-slate-500">
                        No inbound reply has been recorded for this thread yet.
                      </p>
                    )}
                  </div>

                  <div className="surface-card-muted rounded-[24px] p-4">
                    <p className="eyebrow !text-[0.62rem] !tracking-[0.22em]">Reply from platform</p>
                    <form className="mt-4 space-y-4" onSubmit={handleReply}>
                      <label className="field-shell">
                        <span className="field-label">Reply subject</span>
                        <input
                          className="field-input"
                          value={replyForm.subject}
                          onChange={(event) => setReplyForm({ ...replyForm, subject: event.target.value })}
                        />
                      </label>
                      <div className="field-shell">
                        <span className="field-label">Reply body</span>
                        <RichTextEditor
                          value={replyForm.body_html}
                          onChange={({ html, text }) => setReplyForm((current) => ({ ...current, body_html: html, body_text: text }))}
                          placeholder="Write and send the reply from the platform."
                          minHeight={180}
                        />
                      </div>
                      <div className="flex justify-end">
                        <button className="primary-button" type="submit" disabled={sendingReply}>
                          <Send size={16} />
                          <span>{sendingReply ? 'Sending...' : 'Send reply'}</span>
                        </button>
                      </div>
                    </form>
                  </div>
                </aside>
              </div>
            </div>
          ) : (
            <div className="empty-panel flex min-h-[520px] items-center justify-center p-6 text-center text-sm">
              Choose a reply thread from the inbox to read the conversation and answer from here.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
