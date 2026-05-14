import { useEffect, useState } from 'react';
import { Inbox, MessageSquareText, Send } from 'lucide-react';
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

  async function loadThreads(preferredThreadId = null) {
    const response = await api.get('/api/conversations');
    const items = response.data || [];
    setThreads(items);

    const nextThread = preferredThreadId
      ? items.find((thread) => thread.id === preferredThreadId) || items[0] || null
      : items[0] || null;

    if (nextThread) {
      await loadThread(nextThread.id);
    } else {
      setActiveThread(null);
    }
  }

  async function loadThread(threadId) {
    const response = await api.get(`/api/conversations/${threadId}`);
    const thread = response.data || null;
    setActiveThread(thread);
    setReplyForm(createReplyForm(thread?.subject || ''));
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
                    {thread.messages?.[0]?.body_preview || 'No preview yet.'}
                  </p>
                </button>
              ))
            ) : (
              <div className="p-6">
                <div className="empty-panel p-6 text-center text-sm">No reply threads yet.</div>
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
                        {message.direction}
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
