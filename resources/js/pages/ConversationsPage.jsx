import { startTransition, useEffect, useState } from 'react';
import { Inbox, Send } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { RichTextEditor } from '../components/RichTextEditor';
import { api } from '../lib/api';

function createReplyForm(subject = '') {
  return {
    subject,
    body_html: '<p></p>',
    body_text: '',
  };
}

export function ConversationsPage() {
  const location = useLocation();
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [replyForm, setReplyForm] = useState(createReplyForm());
  const [sendingReply, setSendingReply] = useState(false);
  const [loadingThreadId, setLoadingThreadId] = useState(null);
  const [loadingThreads, setLoadingThreads] = useState(false);

  async function loadThreads(preferredThreadId = null) {
    setLoadingThreads(true);
    const response = await api.get('/api/conversations');
    const items = response.data || [];
    startTransition(() => {
      setThreads(items);
    });

    const nextThread = preferredThreadId
      ? items.find((thread) => thread.id === preferredThreadId) || items[0] || null
      : items[0] || null;

    if (nextThread) {
      const activeSummary = {
        ...nextThread,
        messages: nextThread.latest_inbound_message
          ? [nextThread.latest_inbound_message]
          : nextThread.latest_message
            ? [nextThread.latest_message]
            : [],
      };
      startTransition(() => {
        setActiveThread((current) => current?.id === nextThread.id ? current : activeSummary);
      });
      loadThread(nextThread.id).catch(() => toast.error('Could not load the selected reply thread'));
    } else {
      setActiveThread(null);
    }

    setLoadingThreads(false);
  }

  async function loadThread(threadId) {
    setLoadingThreadId(threadId);
    try {
      const response = await api.get(`/api/conversations/${threadId}`);
      const thread = response.data || null;
      startTransition(() => {
        setActiveThread(thread);
        setReplyForm(createReplyForm(thread?.subject || ''));
      });
    } finally {
      setLoadingThreadId(null);
    }
  }

  useEffect(() => {
    loadThreads(location.state?.threadId || null).catch(() => toast.error('Could not load reply threads'));
  }, []);

  async function handleReply(event) {
    event.preventDefault();

    if (!activeThread) {
      return;
    }

    setSendingReply(true);

    try {
      const response = await api.post(`/api/conversations/${activeThread.id}/reply`, replyForm);
      const updated = response.data || null;
      setActiveThread(updated);
      setReplyForm(createReplyForm(updated?.subject || activeThread.subject || ''));
      await loadThreads(activeThread.id);
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
        eyebrow="Replies and bounces"
        title="Review inbound threads without losing the campaign context."
        description="Every reply thread stays attached to its contact so follow-ups, bounce handling, and suppression decisions remain easy to audit."
        stats={[
          { label: 'Threads', value: threads.length },
          { label: 'Selected', value: activeThread ? 1 : 0 },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="surface-card overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                <Inbox size={18} />
              </div>
              <div>
                <p className="eyebrow !text-[0.64rem] !tracking-[0.24em]">Inbox</p>
                <h2 className="text-2xl font-semibold text-slate-950">Reply queue</h2>
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-200">
            {threads.length ? (
              threads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => loadThread(thread.id)}
                  className={`w-full px-5 py-4 text-left transition sm:px-6 ${
                    activeThread?.id === thread.id ? 'bg-blue-50/80' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-950">{thread.contact?.name || thread.subject}</h3>
                      <p className="mt-1 text-sm text-slate-500">{thread.contact?.email}</p>
                    </div>
                    <StatusBadge status={thread.status} />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    {thread.latest_inbound_message?.body_preview || thread.latest_inbound_message?.body_text || 'No inbound reply yet.'}
                  </p>
                  {thread.latest_inbound_message?.sent_at ? (
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-400">
                      Last inbound {new Date(thread.latest_inbound_message.sent_at).toLocaleString()}
                    </p>
                  ) : null}
                </button>
              ))
            ) : (
              <div className="p-6">
                <div className="empty-panel p-6 text-center text-sm">
                  {loadingThreads ? 'Loading reply threads...' : 'No reply threads yet.'}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="surface-card p-5 sm:p-6">
          {activeThread ? (
            <>
              <div className="border-b border-slate-200 pb-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="eyebrow !text-[0.64rem] !tracking-[0.24em]">Conversation thread</p>
                    <h2 className="mt-2 text-3xl font-semibold text-slate-950">{activeThread.subject}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {activeThread.contact?.name || 'Unknown contact'} / {activeThread.contact?.email || 'No email'}
                    </p>
                  </div>
                  <StatusBadge status={activeThread.status} />
                </div>
              </div>

              {activeThread.latest_inbound_message ? (
                <div className="mt-5 rounded-[24px] border border-emerald-200 bg-emerald-50/80 px-4 py-4 sm:px-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Latest inbound reply</span>
                    <span className="text-sm text-emerald-800">
                      {activeThread.latest_inbound_message.sent_at
                        ? new Date(activeThread.latest_inbound_message.sent_at).toLocaleString()
                        : 'Pending'}
                    </span>
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-slate-950">{activeThread.latest_inbound_message.subject}</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                    {activeThread.latest_inbound_message.body_text || activeThread.latest_inbound_message.body_preview || 'No inbound body available yet.'}
                  </p>
                </div>
              ) : null}

              <div className="mt-5 space-y-4">
                {activeThread.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`rounded-[24px] px-4 py-4 sm:px-5 ${
                      message.direction === 'outbound' ? 'bg-blue-50' : 'bg-slate-50'
                    } ${message.direction === 'outbound' ? 'ml-0 sm:ml-12' : 'mr-0 sm:mr-12'}`}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        {message.direction === 'inbound' ? 'reply received' : 'message sent'}
                      </span>
                      <span className="text-sm text-slate-500">
                        {message.sent_at ? new Date(message.sent_at).toLocaleString() : 'Pending'}
                      </span>
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-slate-950">{message.subject}</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                      {message.body_text || message.body_preview || 'No message body available yet.'}
                    </p>
                  </div>
                ))}
              </div>

              {loadingThreadId === activeThread.id ? (
                <div className="mt-4 text-sm text-slate-500">Refreshing conversation...</div>
              ) : null}

              <form className="mt-6 border-t border-slate-200 pt-5" onSubmit={handleReply}>
                <div className="space-y-4">
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
                      minHeight={200}
                    />
                  </div>
                  <div className="flex justify-end">
                    <button className="primary-button" type="submit" disabled={sendingReply}>
                      <Send size={16} />
                      <span>{sendingReply ? 'Sending...' : 'Send reply'}</span>
                    </button>
                  </div>
                </div>
              </form>
            </>
          ) : (
            <div className="empty-panel flex min-h-[420px] items-center justify-center p-6 text-center text-sm">
              Select a thread to inspect the conversation timeline.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
