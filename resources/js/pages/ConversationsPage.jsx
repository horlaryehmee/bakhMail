import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Inbox,
  MailOpen,
  RefreshCw,
  Search,
  Send,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
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

const emptyStats = {
  total: 0,
  inbox: 0,
  sent: 0,
  needs_reply: 0,
  replied: 0,
  bounced: 0,
};

const emptyMeta = {
  current_page: 1,
  last_page: 1,
  per_page: 50,
  total: 0,
  from: null,
  to: null,
};

function createReplyForm(subject = '') {
  return {
    subject,
    body_html: '<p></p>',
    body_text: '',
  };
}

function apiErrorMessage(error, fallback) {
  const firstError = Object.values(error.payload?.errors || {})?.[0]?.[0];

  return firstError || error.payload?.message || error.message || fallback;
}

function buildConversationsUrl({ folder, accountId, search, page }) {
  const params = new URLSearchParams({
    folder,
    page: String(page),
    per_page: '50',
  });

  if (accountId && accountId !== 'all') {
    params.set('account_id', accountId);
  }

  if (search) {
    params.set('search', search);
  }

  return `/api/conversations?${params.toString()}`;
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

  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function previewText(message) {
  return message?.body_text || message?.body_preview || 'No message body available yet.';
}

function threadHeadline(thread) {
  return thread?.contact?.name || thread?.subject || 'Untitled conversation';
}

function threadRecipient(thread) {
  return thread?.contact?.email || 'No email address';
}

function latestThreadMessage(thread) {
  return thread?.latest_inbound_message || thread?.latest_message || null;
}

function threadLatestDirection(thread) {
  return thread?.latest_message?.direction || null;
}

function threadHasBounce(thread) {
  return thread?.status === 'attention'
    || thread?.latest_message?.event_type === 'bounced'
    || thread?.messages?.some((message) => message.event_type === 'bounced');
}

function threadNeedsReply(thread) {
  return Boolean(thread?.latest_inbound_message) && threadLatestDirection(thread) === 'inbound' && !threadHasBounce(thread);
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
  return message?.direction === 'inbound' ? 'Inbox' : 'Sent';
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
  const [accounts, setAccounts] = useState([]);
  const [stats, setStats] = useState(emptyStats);
  const [meta, setMeta] = useState(emptyMeta);
  const [activeThread, setActiveThread] = useState(null);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [replyForm, setReplyForm] = useState(createReplyForm());
  const [sendingReply, setSendingReply] = useState(false);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [syncingMailbox, setSyncingMailbox] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFolder, setActiveFolder] = useState('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim());

  const orderedMessages = useMemo(() => timelineForThread(activeThread), [activeThread]);
  const activeMailboxAccount = useMemo(
    () => accounts.find((account) => String(account.id) === String(accountFilter)) || null,
    [accounts, accountFilter],
  );

  async function loadThread(threadId, { silent = false } = {}) {
    if (!threadId) {
      setActiveThread(null);
      return;
    }

    setLoadingThread(true);

    try {
      const payload = await api.get(`/api/conversations/${threadId}`);
      const thread = payload?.data || payload;

      startTransition(() => {
        setActiveThread(thread);
        setActiveThreadId(thread?.id ?? null);
        setReplyForm(createReplyForm(thread?.subject || ''));
      });
    } catch (error) {
      if (!silent) {
        toast.error(apiErrorMessage(error, 'Could not load conversation'));
      }
    } finally {
      setLoadingThread(false);
    }
  }

  async function loadThreads({ preferredThreadId = null, pageOverride = page } = {}) {
    setLoadingThreads(true);

    try {
      const payload = await api.get(buildConversationsUrl({
        folder: activeFolder,
        accountId: accountFilter,
        search: deferredSearch,
        page: pageOverride,
      }));
      const items = Array.isArray(payload?.data) ? payload.data : [];
      const nextThreadId = preferredThreadId && items.some((thread) => String(thread.id) === String(preferredThreadId))
        ? preferredThreadId
        : items[0]?.id ?? null;

      startTransition(() => {
        setThreads(items);
        setAccounts(payload?.accounts || []);
        setStats({ ...emptyStats, ...(payload?.stats || {}) });
        setMeta({ ...emptyMeta, ...(payload?.meta || {}) });
        setActiveThreadId(nextThreadId);
      });

      if (nextThreadId) {
        const summary = items.find((thread) => String(thread.id) === String(nextThreadId));
        setActiveThread(summary ? { ...summary, messages: [] } : null);
        await loadThread(nextThreadId, { silent: true });
      } else {
        setActiveThread(null);
        setReplyForm(createReplyForm());
      }
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not load mailbox'));
    } finally {
      setLoadingThreads(false);
    }
  }

  async function syncMailbox() {
    setSyncingMailbox(true);

    try {
      const response = await api.post('/api/conversations/sync', {});
      const count = response?.count ?? 0;
      toast.success(count > 0 ? `Synced ${count} mailbox message${count === 1 ? '' : 's'}` : 'Mailbox sync completed');
      await loadThreads({ preferredThreadId: activeThreadId, pageOverride: page });
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not sync mailbox'));
    } finally {
      setSyncingMailbox(false);
    }
  }

  useEffect(() => {
    loadThreads({ preferredThreadId: location.state?.threadId || null, pageOverride: page });
  }, [activeFolder, accountFilter, deferredSearch, page, location.state?.threadId]);

  function selectThread(thread) {
    startTransition(() => {
      setActiveThreadId(thread.id);
      setActiveThread({ ...thread, messages: [] });
      setReplyForm(createReplyForm(thread.subject || ''));
    });

    loadThread(thread.id);
  }

  function updateSearch(value) {
    setSearch(value);
    setPage(1);
  }

  function updateFolder(folderId) {
    setActiveFolder(folderId);
    setPage(1);
  }

  function updateAccountFilter(accountId) {
    setAccountFilter(accountId);
    setPage(1);
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
        setActiveThread(updatedThread);
        setActiveThreadId(updatedThread.id);
        setReplyForm(createReplyForm(updatedThread.subject || activeThread.subject || ''));
        setThreads((current) => current.map((thread) => (
          String(thread.id) === String(updatedThread.id) ? { ...thread, ...updatedThread, messages: [] } : thread
        )));
      });

      toast.success('Reply sent');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not send reply'));
    } finally {
      setSendingReply(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-7rem)] flex-col">
      <section className="surface-card flex min-h-0 flex-1 overflow-hidden">
        <div className="flex h-full min-h-0 w-full flex-col">
          <header className="border-b border-slate-200 px-3 py-3 sm:px-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Inbox size={18} className="text-blue-700" />
                  <h1 className="truncate text-lg font-semibold text-slate-950">Mailbox</h1>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">
                    {meta.total.toLocaleString()} shown in filter
                  </span>
                </div>
                <p className="mt-1 truncate text-sm text-slate-500">
                  {activeMailboxAccount ? activeMailboxAccount.email_address : 'All connected mailbox traffic'}
                </p>
              </div>

              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                <label className="search-shell min-w-0 sm:w-[22rem]">
                  <Search size={16} className="text-slate-400" />
                  <input
                    value={search}
                    onChange={(event) => updateSearch(event.target.value)}
                    className="w-full bg-transparent text-sm text-slate-900 outline-none"
                    placeholder="Search mailbox"
                  />
                </label>

                <button type="button" className="ghost-button !py-2" onClick={syncMailbox} disabled={loadingThreads || syncingMailbox}>
                  <RefreshCw size={16} className={syncingMailbox ? 'animate-spin' : ''} />
                  <span>{syncingMailbox ? 'Syncing' : 'Sync'}</span>
                </button>
              </div>
            </div>
          </header>

          <div className="grid min-h-0 flex-1 xl:grid-cols-[220px_360px_minmax(0,1fr)]">
            <aside className="min-h-0 border-b border-slate-200 bg-slate-50/70 xl:border-b-0 xl:border-r">
              <div className="flex h-full min-h-0 flex-col overflow-y-auto px-3 py-3">
                <div>
                  <p className="px-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Folders</p>
                  <div className="mt-2 space-y-1">
                    {mailboxFolders.map((folder) => (
                      <button
                        key={folder.id}
                        type="button"
                        onClick={() => updateFolder(folder.id)}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                          activeFolder === folder.id
                            ? 'bg-slate-950 text-white'
                            : 'text-slate-700 hover:bg-white'
                        }`}
                      >
                        <span>{folder.label}</span>
                        <span className={`text-xs font-semibold ${activeFolder === folder.id ? 'text-white/80' : 'text-slate-400'}`}>
                          {(stats[folder.id] ?? 0).toLocaleString()}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-5">
                  <p className="px-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Accounts</p>
                  <div className="mt-2 space-y-1">
                    <button
                      type="button"
                      onClick={() => updateAccountFilter('all')}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                        accountFilter === 'all'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-700 hover:bg-white'
                      }`}
                    >
                      <span>All mailboxes</span>
                      <span className={`text-xs font-semibold ${accountFilter === 'all' ? 'text-white/80' : 'text-slate-400'}`}>
                        {stats.total.toLocaleString()}
                      </span>
                    </button>

                    {accounts.map((account) => (
                      <button
                        key={account.id}
                        type="button"
                        onClick={() => updateAccountFilter(String(account.id))}
                        className={`w-full rounded-xl px-3 py-2 text-left transition ${
                          String(accountFilter) === String(account.id)
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-700 hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">{account.name || account.email_address}</span>
                          <span className={`text-xs font-semibold ${String(accountFilter) === String(account.id) ? 'text-white/80' : 'text-slate-400'}`}>
                            {(account.threads_count || 0).toLocaleString()}
                          </span>
                        </div>
                        <p className={`mt-0.5 truncate text-xs ${String(accountFilter) === String(account.id) ? 'text-white/70' : 'text-slate-400'}`}>
                          {account.email_address}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </aside>

            <section className="flex min-h-0 flex-col border-b border-slate-200 xl:border-b-0 xl:border-r">
              <div className="border-b border-slate-200 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">
                      {mailboxFolders.find((folder) => folder.id === activeFolder)?.label || 'Mailbox'}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {meta.from || 0}-{meta.to || 0} of {meta.total.toLocaleString()}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">
                    {loadingThreads ? 'Loading' : 'Live'}
                  </span>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {threads.length ? (
                  <div className="divide-y divide-slate-200">
                    {threads.map((thread) => {
                      const selected = String(activeThreadId) === String(thread.id);
                      const latestMessage = latestThreadMessage(thread);
                      const tone = mailboxTone(thread);

                      return (
                        <button
                          key={thread.id}
                          type="button"
                          onClick={() => selectThread(thread)}
                          className={`w-full px-3 py-3 text-left transition ${
                            selected ? 'bg-blue-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`h-2 w-2 rounded-full ${
                                  tone === 'emerald'
                                    ? 'bg-emerald-500'
                                    : tone === 'rose'
                                      ? 'bg-rose-500'
                                      : tone === 'blue'
                                        ? 'bg-blue-500'
                                        : 'bg-slate-300'
                                }`}
                                />
                                <h3 className="truncate text-sm font-semibold text-slate-950">{threadHeadline(thread)}</h3>
                              </div>
                              <p className="mt-0.5 truncate text-xs text-slate-500">{threadRecipient(thread)}</p>
                            </div>

                            <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                              {formatShortDate(latestMessage?.sent_at || thread.last_message_at)}
                            </span>
                          </div>

                          <div className="mt-2 flex items-center justify-between gap-2">
                            <h4 className="min-w-0 truncate text-sm font-medium text-slate-900">
                              {thread.subject || 'No subject'}
                            </h4>
                            <span className="shrink-0 text-xs text-slate-400">{thread.stats?.message_count || 0}</span>
                          </div>
                          <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs leading-5 text-slate-500">
                            {previewText(latestMessage)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4">
                    <div className="empty-panel p-5 text-center text-sm">
                      {loadingThreads ? 'Loading mailbox conversations...' : 'No conversations match the current filters.'}
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <button
                    className="ghost-button !px-3 !py-2"
                    type="button"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={loadingThreads || meta.current_page <= 1}
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <span className="text-xs font-semibold text-slate-500">
                    Page {meta.current_page} / {meta.last_page}
                  </span>
                  <button
                    className="ghost-button !px-3 !py-2"
                    type="button"
                    onClick={() => setPage((current) => Math.min(meta.last_page, current + 1))}
                    disabled={loadingThreads || meta.current_page >= meta.last_page}
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            </section>

            <section className="min-h-0 bg-white">
              {activeThread ? (
                <div className="flex h-full min-h-0 flex-col">
                  <div className="border-b border-slate-200 px-4 py-3">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-xs text-slate-500">
                          {activeThread.email_account?.email_address || 'Mailbox'} / {threadRecipient(activeThread)}
                        </p>
                        <h2 className="mt-1 truncate text-lg font-semibold text-slate-950">
                          {activeThread.subject || 'Untitled conversation'}
                        </h2>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={activeThread.status} />
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">
                          {activeThread.stats?.message_count || orderedMessages.length} messages
                        </span>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">
                          {loadingThread ? 'Loading' : threadNeedsReply(activeThread) ? 'Needs reply' : 'Covered'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                    <div className="mx-auto flex max-w-4xl flex-col gap-3">
                      {activeThread.latest_inbound_message ? (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-2">
                              <MailOpen size={15} className="text-emerald-700" />
                              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">
                                Latest inbound
                              </p>
                            </div>
                            <span className="text-xs text-emerald-900/70">
                              {formatDateTime(activeThread.latest_inbound_message.sent_at)}
                            </span>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
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
                              className={`w-full max-w-3xl rounded-xl border px-4 py-3 ${
                                inbound
                                  ? 'mr-auto border-emerald-200 bg-emerald-50/60'
                                  : 'ml-auto border-slate-200 bg-blue-50/60'
                              }`}
                            >
                              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex flex-wrap items-center gap-2">
                                  <StatusBadge status={messageLabel(message)} tone={inbound ? 'emerald' : 'blue'} />
                                  <StatusBadge status={message.event_type} />
                                </div>
                                <span className="text-xs text-slate-500">{formatDateTime(message.sent_at)}</span>
                              </div>

                              <h3 className="mt-2 text-sm font-semibold text-slate-950">{message.subject || 'No subject'}</h3>
                              <p className="mt-1 truncate text-xs text-slate-500">
                                {message.sender_email || 'Unknown sender'} to {message.recipient_email || 'Unknown recipient'}
                              </p>
                              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                                {previewText(message)}
                              </p>
                            </article>
                          );
                        })
                      ) : (
                        <div className="empty-panel p-5 text-center text-sm">
                          {loadingThread ? 'Loading conversation...' : 'No timeline is available for this conversation yet.'}
                        </div>
                      )}
                    </div>
                  </div>

                  <form className="border-t border-slate-200 bg-slate-50/70 px-4 py-3" onSubmit={handleReply}>
                    <div className="mx-auto grid max-w-4xl gap-3">
                      <label className="field-shell !rounded-xl !p-3">
                        <span className="field-label">Subject</span>
                        <input
                          className="field-input"
                          value={replyForm.subject}
                          onChange={(event) => setReplyForm((current) => ({ ...current, subject: event.target.value }))}
                        />
                      </label>

                      <div className="field-shell !rounded-xl !p-3">
                        <span className="field-label">Reply</span>
                        <RichTextEditor
                          value={replyForm.body_html}
                          onChange={({ html, text }) => setReplyForm((current) => ({ ...current, body_html: html, body_text: text }))}
                          placeholder="Write your reply."
                          minHeight={140}
                        />
                      </div>

                      <div className="flex justify-end">
                        <button className="primary-button !py-2" type="submit" disabled={sendingReply || loadingThread}>
                          <Send size={16} />
                          <span>{sendingReply ? 'Sending...' : 'Send reply'}</span>
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="empty-panel flex h-full min-h-[32rem] items-center justify-center p-6 text-center text-sm">
                  {loadingThreads
                    ? 'Loading mailbox conversations...'
                    : 'No mailbox conversations are available yet.'}
                </div>
              )}
            </section>
          </div>
        </div>
      </section>
    </div>
  );
}
