import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  ChevronRight,
  Inbox,
  MailOpen,
  MailPlus,
  RefreshCw,
  Search,
  Send,
  TriangleAlert,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { RichTextEditor } from '../components/RichTextEditor';
import { api } from '../lib/api';

const mailboxFolders = [
  { id: 'all', label: 'All mail' },
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

function formatShortDate(value) {
  if (!value) {
    return 'Pending';
  }

  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();

  if (sameDay) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function previewText(message) {
  return message?.body_text || message?.body_preview || 'No message body available yet.';
}

function threadHeadline(thread) {
  return thread.contact?.name || thread.subject || 'Untitled conversation';
}

function threadRecipient(thread) {
  return thread.contact?.email || 'No email address';
}

function latestThreadMessage(thread) {
  return thread.latest_inbound_message || thread.latest_message || null;
}

function threadPreview(thread) {
  return previewText(latestThreadMessage(thread));
}

function threadLatestDirection(thread) {
  return thread.latest_message?.direction || null;
}

function threadNeedsReply(thread) {
  return Boolean(thread.latest_inbound_message) && threadLatestDirection(thread) === 'inbound' && !threadHasBounce(thread);
}

function threadHasBounce(thread) {
  return thread.status === 'attention'
    || thread.latest_message?.event_type === 'bounced'
    || thread.messages?.some((message) => message.event_type === 'bounced');
}

function threadFilterMatches(thread, filterId) {
  const latestDirection = threadLatestDirection(thread);
  const hasInbound = Boolean(thread.stats?.has_inbound_reply || thread.latest_inbound_message);
  const hasBounce = threadHasBounce(thread);

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
    thread.email_account?.email_address,
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

function mailboxTone(thread) {
  if (threadHasBounce(thread)) {
    return 'rose';
  }

  if (threadNeedsReply(thread)) {
    return 'emerald';
  }

  if (threadLatestDirection(thread) === 'outbound') {
    return 'blue';
  }

  return 'slate';
}

function messageLabel(message) {
  if (message.direction === 'inbound') {
    return 'Inbox';
  }

  return 'Sent';
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
  const [activeFolder, setActiveFolder] = useState('all');
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
      toast.error(error.payload?.message || error.message || 'Could not load mailbox');
    } finally {
      setLoadingThreads(false);
    }
  }

  async function syncMailbox({ silent = false, preferredThreadId = null } = {}) {
    setSyncingMailbox(true);

    try {
      const response = await api.post('/api/conversations/sync', {});

      if (!silent) {
        const count = response?.count ?? 0;
        toast.success(count > 0 ? `Synced ${count} mailbox message${count === 1 ? '' : 's'}` : 'Mailbox sync completed');
      }

      await loadThreads(preferredThreadId || activeThreadId);
    } catch (error) {
      if (!silent) {
        toast.error(error.payload?.message || error.message || 'Could not sync mailbox');
      }
    } finally {
      setSyncingMailbox(false);
    }
  }

  useEffect(() => {
    loadThreads(location.state?.threadId || null);
    syncMailbox({ silent: true, preferredThreadId: location.state?.threadId || null });
  }, [location.state?.threadId]);

  const mailboxAccounts = useMemo(() => {
    const entries = threads
      .map((thread) => thread.email_account)
      .filter((account) => account?.id);

    return entries.filter((account, index) => entries.findIndex((item) => item.id === account.id) === index);
  }, [threads]);

  const filteredThreads = useMemo(
    () => threads
      .filter((thread) => accountFilter === 'all' || String(thread.email_account?.id || '') === String(accountFilter))
      .filter((thread) => threadFilterMatches(thread, activeFolder))
      .filter((thread) => threadSearchMatches(thread, deferredSearch)),
    [threads, accountFilter, activeFolder, deferredSearch],
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

  const inboxStats = useMemo(() => ({
    total: threads.length,
    inbox: threads.filter((thread) => threadFilterMatches(thread, 'inbox')).length,
    sent: threads.filter((thread) => threadFilterMatches(thread, 'sent')).length,
    needsReply: threads.filter((thread) => threadFilterMatches(thread, 'needs_reply')).length,
    bounced: threads.filter((thread) => threadFilterMatches(thread, 'bounced')).length,
  }), [threads]);

  const orderedMessages = useMemo(() => timelineForThread(activeThread), [activeThread]);

  const folderCounts = useMemo(() => ({
    all: inboxStats.total,
    inbox: inboxStats.inbox,
    sent: inboxStats.sent,
    needs_reply: inboxStats.needsReply,
    replied: threads.filter((thread) => threadFilterMatches(thread, 'replied')).length,
    bounced: inboxStats.bounced,
  }), [inboxStats, threads]);

  const activeMailboxAccount = useMemo(
    () => mailboxAccounts.find((account) => String(account.id) === String(accountFilter)) || null,
    [mailboxAccounts, accountFilter],
  );

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
    <div className="flex min-h-[calc(100vh-8.5rem)] flex-col gap-4">
      <PageHeader
        eyebrow="Mailbox"
        title="Mailbox workspace"
        description={activeMailboxAccount
          ? `Focused on ${activeMailboxAccount.email_address}`
          : 'Review inbox and sent traffic from a full webmail-style workspace.'}
        actions={(
          <>
            <label className="search-shell min-w-0 sm:w-[22rem]">
              <Search size={16} className="text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full bg-transparent text-sm text-slate-900 outline-none"
                placeholder="Search people, subjects, mailboxes, or message text"
              />
            </label>

            <button type="button" className="ghost-button" onClick={() => syncMailbox()} disabled={loadingThreads || syncingMailbox}>
              <RefreshCw size={16} className={syncingMailbox ? 'animate-spin' : ''} />
              <span>{syncingMailbox ? 'Syncing' : 'Sync mailbox'}</span>
            </button>
          </>
        )}
        stats={[
          { label: 'Threads', value: inboxStats.total },
          { label: 'Inbox', value: inboxStats.inbox },
          { label: 'Sent', value: inboxStats.sent },
          { label: 'Needs reply', value: inboxStats.needsReply },
          { label: 'Bounces', value: inboxStats.bounced },
        ]}
      />

      <section className="surface-card flex min-h-0 flex-1 overflow-hidden">
        <div className="grid h-full min-h-0 w-full xl:grid-cols-[280px_380px_minmax(0,1fr)]">
          <aside className="min-h-0 border-b border-slate-200 bg-slate-50/70 xl:border-b-0 xl:border-r">
            <div className="flex h-full flex-col">
              <div className="border-b border-slate-200 px-5 py-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[1.4rem] bg-blue-100 text-blue-700">
                    <Inbox size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="eyebrow !text-[0.62rem] !tracking-[0.22em]">Mailbox Console</p>
                    <h2 className="truncate text-xl font-semibold text-slate-950">Connected mailboxes</h2>
                    <p className="mt-1 text-sm text-slate-500">{mailboxAccounts.length} active senders</p>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
                <div className="surface-card-muted rounded-[24px] p-4">
                  <div className="flex items-center gap-2">
                    <MailPlus size={16} className="text-blue-700" />
                    <p className="text-sm font-semibold text-slate-900">Folders</p>
                  </div>

                  <div className="mt-4 space-y-2">
                    {mailboxFolders.map((folder) => (
                      <button
                        key={folder.id}
                        type="button"
                        onClick={() => setActiveFolder(folder.id)}
                        className={`flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm transition ${
                          activeFolder === folder.id
                            ? 'bg-slate-950 text-white'
                            : 'bg-white text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span>{folder.label}</span>
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${activeFolder === folder.id ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'}`}>
                          {folderCounts[folder.id] ?? 0}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="surface-card-muted rounded-[24px] p-4">
                  <p className="text-sm font-semibold text-slate-900">Accounts</p>

                  <div className="mt-4 space-y-2">
                    <button
                      type="button"
                      onClick={() => setAccountFilter('all')}
                      className={`flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-sm transition ${
                        accountFilter === 'all'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span>All mailboxes</span>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${accountFilter === 'all' ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        {threads.length}
                      </span>
                    </button>

                    {mailboxAccounts.map((account) => {
                      const count = threads.filter((thread) => String(thread.email_account?.id || '') === String(account.id)).length;

                      return (
                        <button
                          key={account.id}
                          type="button"
                          onClick={() => setAccountFilter(String(account.id))}
                          className={`w-full rounded-2xl px-3 py-3 text-left transition ${
                            String(accountFilter) === String(account.id)
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="truncate text-sm font-medium">{account.name || account.email_address}</span>
                            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${String(accountFilter) === String(account.id) ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'}`}>
                              {count}
                            </span>
                          </div>
                          <p className={`mt-1 truncate text-xs ${String(accountFilter) === String(account.id) ? 'text-white/80' : 'text-slate-500'}`}>
                            {account.email_address}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="surface-card-muted rounded-[24px] p-4">
                  <div className="flex items-center gap-2">
                    <TriangleAlert size={16} className="text-slate-500" />
                    <p className="text-sm font-semibold text-slate-900">Queue health</p>
                  </div>

                  <dl className="mt-4 space-y-3 text-sm text-slate-600">
                    <div className="flex items-center justify-between gap-3">
                      <dt>Needs reply</dt>
                      <dd>{inboxStats.needsReply}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt>Bounced</dt>
                      <dd>{inboxStats.bounced}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt>Visible threads</dt>
                      <dd>{filteredThreads.length}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          </aside>

          <section className="min-h-0 border-b border-slate-200 xl:border-b-0 xl:border-r">
            <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    {mailboxFolders.find((folder) => folder.id === activeFolder)?.label || 'Mailbox'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {filteredThreads.length} conversation{filteredThreads.length === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {loadingThreads ? 'Loading' : 'Live'}
                </div>
              </div>
            </div>

            <div className="min-h-0 overflow-y-auto">
              {filteredThreads.length ? (
                <div className="divide-y divide-slate-200">
                  {filteredThreads.map((thread) => {
                    const selected = String(activeThread?.id) === String(thread.id);
                    const latestMessage = latestThreadMessage(thread);

                    return (
                      <button
                        key={thread.id}
                        type="button"
                        onClick={() => selectThread(thread)}
                        className={`w-full px-4 py-4 text-left transition sm:px-5 ${
                          selected ? 'bg-blue-50/80' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`h-2.5 w-2.5 rounded-full ${
                                mailboxTone(thread) === 'emerald'
                                  ? 'bg-emerald-500'
                                  : mailboxTone(thread) === 'rose'
                                    ? 'bg-rose-500'
                                    : mailboxTone(thread) === 'blue'
                                      ? 'bg-blue-500'
                                      : 'bg-slate-300'
                              }`}
                              />
                              <h3 className="truncate text-sm font-semibold text-slate-950">{threadHeadline(thread)}</h3>
                            </div>

                            <p className="mt-1 truncate text-sm text-slate-500">{threadRecipient(thread)}</p>
                          </div>

                          <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                            {formatShortDate(latestMessage?.sent_at || thread.last_message_at)}
                          </span>
                        </div>

                        <div className="mt-3 flex items-center gap-2">
                          <StatusBadge status={messageLabel(thread.latest_message || {})} tone={threadLatestDirection(thread) === 'inbound' ? 'emerald' : 'blue'} />
                          <StatusBadge status={thread.status} />
                        </div>

                        <h4 className="mt-3 truncate text-sm font-medium text-slate-900">
                          {thread.subject || 'No subject'}
                        </h4>
                        <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                          {threadPreview(thread)}
                        </p>

                        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-400">
                          <span className="truncate">{thread.email_account?.email_address || 'Unknown mailbox'}</span>
                          <span>{thread.stats?.message_count || 0} msgs</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-5">
                  <div className="empty-panel p-6 text-center text-sm">
                    {loadingThreads ? 'Loading mailbox conversations...' : 'No mailbox conversations match the current filters.'}
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="min-h-0 bg-white">
            {activeThread ? (
              <div className="flex h-full min-h-0 flex-col">
                <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <span>{activeThread.email_account?.email_address || 'Mailbox'}</span>
                      <ChevronRight size={14} />
                      <span>{mailboxFolders.find((folder) => folder.id === activeFolder)?.label || 'All mail'}</span>
                    </div>

                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <h2 className="text-2xl font-semibold text-slate-950">
                          {activeThread.subject || 'Untitled conversation'}
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-slate-500">
                          {threadHeadline(activeThread)} / {threadRecipient(activeThread)}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-500">
                          Source: {activeThread.campaign?.name || 'Direct conversation'}
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
                        <div className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                          {threadNeedsReply(activeThread) ? 'Needs reply' : 'Covered'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                  <div className="mx-auto flex max-w-4xl flex-col gap-4">
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
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                          {previewText(activeThread.latest_inbound_message)}
                        </p>
                      </div>
                    ) : null}

                    {orderedMessages.length ? (
                      orderedMessages.map((message) => {
                        const inbound = message.direction === 'inbound';

                        return (
                          <article
                            key={message.id}
                            className={`rounded-[24px] border px-4 py-4 shadow-sm sm:px-5 ${
                              inbound
                                ? 'mr-auto w-full max-w-3xl border-emerald-200 bg-emerald-50/80'
                                : 'ml-auto w-full max-w-3xl border-slate-200 bg-blue-50/70'
                            }`}
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex flex-wrap items-center gap-2">
                                <StatusBadge status={messageLabel(message)} tone={inbound ? 'emerald' : 'blue'} />
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
                        No timeline is available for this conversation yet.
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t border-slate-200 bg-slate-50/70 px-5 py-5 sm:px-6">
                  <div className="mx-auto max-w-4xl">
                    <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                      <div className="rounded-full bg-white px-3 py-2 font-semibold text-slate-700 shadow-sm">
                        {threadLatestDirection(activeThread) || 'Unknown'} latest
                      </div>
                      <div className="rounded-full bg-white px-3 py-2 font-semibold text-slate-700 shadow-sm">
                        {formatDateTime(activeThread.last_message_at)}
                      </div>
                      <div className="rounded-full bg-white px-3 py-2 font-semibold text-slate-700 shadow-sm">
                        {activeThread.email_account?.email_address || 'Unknown mailbox'}
                      </div>
                    </div>

                    <form className="space-y-4" onSubmit={handleReply}>
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
                </div>
              </div>
            ) : (
              <div className="empty-panel flex h-full min-h-[42rem] items-center justify-center p-6 text-center text-sm">
                {loadingThreads
                  ? 'Loading mailbox conversations...'
                  : 'No mailbox conversations are available yet. Sync a connected account to populate this page.'}
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
