import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Inbox, MailOpen, RefreshCw, Search, Send, TriangleAlert } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { RichTextEditor } from '../components/RichTextEditor';
import { api } from '../lib/api';

const inboxFilters = [
  { id: 'all', label: 'All threads' },
  { id: 'inbox', label: 'Inbox' },
  { id: 'sent', label: 'Sent' },
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

function normalizeThreadsResponse(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  return [];
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

function threadHeadline(thread) {
  return thread.contact?.name || thread.subject || 'Untitled conversation';
}

function threadRecipient(thread) {
  return thread.contact?.email || 'No email address';
}

function threadActivityLabel(thread) {
  if (thread.latest_inbound_message) {
    return 'Latest inbound';
  }

  if (thread.latest_message?.direction === 'outbound') {
    return 'Latest sent';
  }

  return 'Latest activity';
}

function threadFilterMatches(thread, filterId) {
  const latestDirection = thread.latest_message?.direction || null;
  const hasInbound = Boolean(thread.stats?.has_inbound_reply || thread.latest_inbound_message);
  const hasBounce = thread.status === 'attention'
    || thread.latest_message?.event_type === 'bounced'
    || thread.messages?.some((message) => message.event_type === 'bounced');

  if (filterId === 'all') {
    return true;
  }

  if (filterId === 'inbox') {
    return latestDirection === 'inbound';
  }

  if (filterId === 'sent') {
    return latestDirection === 'outbound';
  }

  if (filterId === 'needs_reply') {
    return hasInbound && latestDirection === 'inbound' && !hasBounce;
  }

  if (filterId === 'replied') {
    return hasInbound && latestDirection === 'outbound' && !hasBounce;
  }

  if (filterId === 'bounced') {
    return hasBounce;
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
    ...(thread.messages || []).flatMap((message) => [
      message.subject,
      message.body_text,
      message.body_preview,
      message.sender_email,
      message.recipient_email,
    ]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(query);
}

function timelineForThread(thread) {
  const messages = Array.isArray(thread?.messages) ? [...thread.messages] : [];

  return messages.sort((left, right) => {
    const leftTime = left?.sent_at ? new Date(left.sent_at).getTime() : 0;
    const rightTime = right?.sent_at ? new Date(right.sent_at).getTime() : 0;

    if (leftTime === rightTime) {
      return (left?.id || 0) - (right?.id || 0);
    }

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
  const [syncingMailbox, setSyncingMailbox] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  async function loadThreads(preferredThreadId = null) {
    setLoadingThreads(true);

    try {
      const payload = await api.get('/api/conversations');
      const items = normalizeThreadsResponse(payload);

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
    } catch (error) {
      toast.error(error.payload?.message || error.message || 'Could not load reply threads');
    } finally {
      setLoadingThreads(false);
    }
  }

  useEffect(() => {
    loadThreads(location.state?.threadId || null);
    syncMailbox({ silent: true, preferredThreadId: location.state?.threadId || null });
  }, [location.state?.threadId]);

  async function syncMailbox({ silent = false, preferredThreadId = null } = {}) {
    setSyncingMailbox(true);

    try {
      const response = await api.post('/api/conversations/sync', {});

      if (! silent) {
        const count = response?.count ?? 0;
        toast.success(count > 0 ? `Synced ${count} mailbox message${count === 1 ? '' : 's'}` : 'Mailbox sync completed');
      }

      await loadThreads(preferredThreadId || activeThreadId);
    } catch (error) {
      if (! silent) {
        toast.error(error.payload?.message || error.message || 'Could not sync mailbox');
      }
    } finally {
      setSyncingMailbox(false);
    }
  }

  const mailboxAccounts = useMemo(() => {
    const entries = threads
      .map((thread) => thread.email_account)
      .filter((account) => account?.id);

    return entries.filter((account, index) => entries.findIndex((item) => item.id === account.id) === index);
  }, [threads]);

  const filteredThreads = useMemo(
    () => threads
      .filter((thread) => accountFilter === 'all' || String(thread.email_account?.id || '') === String(accountFilter))
      .filter((thread) => threadFilterMatches(thread, activeFilter))
      .filter((thread) => threadSearchMatches(thread, deferredSearch)),
    [threads, accountFilter, activeFilter, deferredSearch],
  );

  const activeThread = useMemo(() => {
    const thread = filteredThreads.find((item) => String(item.id) === String(activeThreadId));

    if (thread) {
      return thread;
    }

    const anyThread = threads.find((item) => String(item.id) === String(activeThreadId));

    if (anyThread) {
      return anyThread;
    }

    return filteredThreads[0] || threads[0] || null;
  }, [filteredThreads, threads, activeThreadId]);

  const orderedMessages = useMemo(
    () => timelineForThread(activeThread),
    [activeThread],
  );

  const inboxStats = useMemo(() => ({
    total: threads.length,
    inbox: threads.filter((thread) => threadFilterMatches(thread, 'inbox')).length,
    sent: threads.filter((thread) => threadFilterMatches(thread, 'sent')).length,
    needsReply: threads.filter((thread) => threadFilterMatches(thread, 'needs_reply')).length,
    replied: threads.filter((thread) => threadFilterMatches(thread, 'replied')).length,
    bounced: threads.filter((thread) => threadFilterMatches(thread, 'bounced')).length,
  }), [threads]);

  useEffect(() => {
    if (!activeThread) {
      return;
    }

    if (String(activeThread.id) !== String(activeThreadId)) {
      startTransition(() => {
        setActiveThreadId(activeThread.id);
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
      const payload = await api.post(`/api/conversations/${activeThread.id}/reply`, replyForm);
      const updatedThread = payload?.data || payload;

      if (!updatedThread?.id) {
        throw new Error('Reply sent but the thread payload was invalid.');
      }

      startTransition(() => {
        setThreads((current) => {
          const exists = current.some((thread) => String(thread.id) === String(updatedThread.id));

          if (!exists) {
            return [updatedThread, ...current];
          }

          return current.map((thread) => (String(thread.id) === String(updatedThread.id) ? updatedThread : thread));
        });
        setActiveThreadId(updatedThread.id);
        setReplyForm(createReplyForm(updatedThread.subject || activeThread.subject || ''));
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
        title="Run replies as a real inbox."
        description="Open the newest inbound reply fast, keep the full conversation visible, and answer from the same workspace without waiting on a second thread request."
        stats={[
          { label: 'Threads', value: inboxStats.total },
          { label: 'Inbox', value: inboxStats.inbox },
          { label: 'Sent', value: inboxStats.sent },
          { label: 'Needs reply', value: inboxStats.needsReply },
          { label: 'Bounces', value: inboxStats.bounced },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className="surface-card overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                  <Inbox size={18} />
                </div>
                <div>
                  <p className="eyebrow !text-[0.64rem] !tracking-[0.24em]">Inbox</p>
                  <h2 className="text-2xl font-semibold text-slate-950">Reply threads</h2>
                </div>
              </div>

              <button type="button" className="ghost-button" onClick={() => syncMailbox()} disabled={loadingThreads || syncingMailbox}>
                <RefreshCw size={16} className={syncingMailbox ? 'animate-spin' : ''} />
                <span>{syncingMailbox ? 'Syncing' : 'Sync mailbox'}</span>
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <label className="search-shell">
                <Search size={16} className="text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full bg-transparent text-sm text-slate-900 outline-none"
                  placeholder="Search contact, subject, email, or reply text"
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

              {mailboxAccounts.length ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={`ghost-button ${accountFilter === 'all' ? '!border-blue-200 !bg-blue-50 !text-blue-700' : ''}`}
                    onClick={() => setAccountFilter('all')}
                  >
                    All mailboxes
                  </button>
                  {mailboxAccounts.map((account) => (
                    <button
                      key={account.id}
                      type="button"
                      className={`ghost-button ${String(accountFilter) === String(account.id) ? '!border-blue-200 !bg-blue-50 !text-blue-700' : ''}`}
                      onClick={() => setAccountFilter(String(account.id))}
                    >
                      {account.name || account.email_address}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="max-h-[calc(100vh-15rem)] overflow-y-auto divide-y divide-slate-200">
            {filteredThreads.length ? (
              filteredThreads.map((thread) => {
                const selected = String(activeThread?.id) === String(thread.id);
                const inbound = thread.latest_inbound_message;
                const needsReply = threadFilterMatches(thread, 'needs_reply');

                return (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => selectThread(thread)}
                    className={`w-full px-5 py-4 text-left transition sm:px-6 ${selected ? 'bg-blue-50/80' : 'hover:bg-slate-50'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate font-semibold text-slate-950">{threadHeadline(thread)}</h3>
                          {needsReply ? <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> : null}
                        </div>
                        <p className="mt-1 truncate text-sm text-slate-500">{threadRecipient(thread)}</p>
                      </div>
                      <StatusBadge status={thread.status} />
                    </div>

                    <div className="mt-3 rounded-[18px] bg-white/70 px-3 py-3 text-sm text-slate-600">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {threadActivityLabel(thread)}
                      </p>
                      <p className="mt-2 line-clamp-3 whitespace-pre-wrap">{threadPreview(thread)}</p>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 text-xs uppercase tracking-[0.16em] text-slate-400">
                      <span>{thread.email_account?.email_address || thread.campaign?.name || 'Direct conversation'}</span>
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
              <div className="flex flex-col gap-5 border-b border-slate-200 pb-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="eyebrow !text-[0.64rem] !tracking-[0.24em]">Selected thread</p>
                    <h2 className="mt-2 text-3xl font-semibold text-slate-950">{activeThread.subject || 'Untitled conversation'}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {threadHeadline(activeThread)} / {threadRecipient(activeThread)}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      Source: {activeThread.campaign?.name || 'Direct conversation'}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      Mailbox: {activeThread.email_account?.email_address || 'Unknown mailbox'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={activeThread.status} />
                    <div className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {activeThread.stats?.message_count || orderedMessages.length} messages
                    </div>
                    <div className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {activeThread.stats?.inbound_count || 0} inbound
                    </div>
                  </div>
                </div>

                {activeThread.latest_inbound_message ? (
                  <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/80 px-4 py-4 sm:px-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2">
                        <MailOpen size={16} className="text-emerald-700" />
                        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-800">
                          Latest inbound reply
                        </p>
                      </div>
                      <span className="text-sm text-emerald-900/70">
                        {formatDateTime(activeThread.latest_inbound_message.sent_at)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-700">
                      {previewText(activeThread.latest_inbound_message)}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500 sm:px-5">
                    No inbound reply has been recorded for this thread yet.
                  </div>
                )}
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
                <div className="space-y-4">
                  {orderedMessages.length ? (
                    orderedMessages.map((message) => {
                      const inbound = message.direction === 'inbound';

                      return (
                        <article
                          key={message.id}
                          className={`rounded-[24px] border px-4 py-4 sm:px-5 ${
                            inbound
                              ? 'border-emerald-200 bg-emerald-50/80'
                              : 'border-slate-200 bg-blue-50/70'
                          }`}
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusBadge
                                status={inbound ? 'reply received' : 'message sent'}
                                tone={inbound ? 'emerald' : 'blue'}
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
                        </article>
                      );
                    })
                  ) : (
                    <div className="empty-panel p-6 text-center text-sm">
                      No timeline is available for this thread yet.
                    </div>
                  )}
                </div>

                <aside className="space-y-4">
                  <div className="surface-card-muted rounded-[24px] p-4">
                    <div className="flex items-center gap-2">
                      <TriangleAlert size={16} className="text-slate-500" />
                      <p className="eyebrow !text-[0.62rem] !tracking-[0.22em]">Thread summary</p>
                    </div>

                    <dl className="mt-4 space-y-3 text-sm text-slate-600">
                      <div className="flex items-center justify-between gap-3">
                        <dt>Needs reply</dt>
                        <dd>{threadFilterMatches(activeThread, 'needs_reply') ? 'Yes' : 'No'}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt>Latest activity</dt>
                        <dd>{threadActivityLabel(activeThread)}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt>Outbound messages</dt>
                        <dd>{activeThread.stats?.outbound_count || 0}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <dt>Last update</dt>
                        <dd>{formatDateTime(activeThread.last_message_at)}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="surface-card-muted rounded-[24px] p-4">
                    <p className="eyebrow !text-[0.62rem] !tracking-[0.22em]">Reply from platform</p>
                    <form className="mt-4 space-y-4" onSubmit={handleReply}>
                      <label className="field-shell">
                        <span className="field-label">Reply subject</span>
                        <input
                          className="field-input"
                          value={replyForm.subject}
                          onChange={(event) => setReplyForm((current) => ({ ...current, subject: event.target.value }))}
                        />
                      </label>

                      <div className="field-shell">
                        <span className="field-label">Reply body</span>
                        <RichTextEditor
                          value={replyForm.body_html}
                          onChange={({ html, text }) => setReplyForm((current) => ({ ...current, body_html: html, body_text: text }))}
                          placeholder="Write and send the reply from the platform."
                          minHeight={200}
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
              {loadingThreads
                ? 'Loading reply threads...'
                : 'No reply threads are available yet. Once replies sync in, they will appear here.'}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
