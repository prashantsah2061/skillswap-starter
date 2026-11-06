"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { loadMatches, loadMessages, sendMessage, type MatchSummary, type PersistedMessage } from "@/lib/discovery/client";
import { SafetyActions } from "@/components/safety/safety-actions";

export function Messages({ selectedId }: { selectedId?: string }) {
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [messages, setMessages] = useState<PersistedMessage[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const active = useMemo(() => selectedId ? matches.find(match => match.id === selectedId) : matches[0], [matches, selectedId]);

  useEffect(() => {
    const controller = new AbortController();
    loadMatches(controller.signal).then(result => setMatches(result.data))
      .catch(reason => setError(reason instanceof Error ? reason.message : "Conversations could not be loaded."))
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!active) { setMessages([]); setCursor(null); return; }
    const controller = new AbortController();
    setLoading(true); setError(""); setMessages([]); setCursor(null);
    loadMessages(active.id, null, controller.signal).then(result => {
      setMessages(result.data); setCursor(result.meta.next_cursor);
    }).catch(reason => setError(reason instanceof Error ? reason.message : "Messages could not be loaded."))
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [active?.id]);

  async function refresh() {
    if (!active) return;
    setError("");
    try {
      const page = await loadMessages(active.id);
      setMessages(current => {
        const byId = new Map(current.map(message => [message.id, message]));
        page.data.forEach(message => byId.set(message.id, message));
        return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
      });
      setNotice("Conversation refreshed.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Messages could not be refreshed."); }
  }

  async function loadOlder() {
    if (!active || !cursor) return;
    setError("");
    try {
      const page = await loadMessages(active.id, cursor);
      setMessages(current => [...page.data, ...current]); setCursor(page.meta.next_cursor);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Earlier messages could not be loaded."); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!active || !draft.trim() || sending) return;
    setSending(true); setError(""); setNotice("");
    try {
      const result = await sendMessage(active.id, draft.trim());
      setMessages(current => [...current, result.data]); setDraft(""); setNotice("Message sent.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Message could not be sent. Retry when you’re back online."); }
    finally { setSending(false); }
  }

  return <>
    <h1>Messages</h1><p className="subtitle">Say hello. Find your rhythm. Learn together.</p>
    <div className="messenger card">
      <aside className="conversation-list"><h2>Your conversations</h2>
        {matches.map(match => <Link href={`/messages/${match.id}`} className={`conversation ${match.id === active?.id ? "selected" : ""}`} key={match.id}>
          <span className="avatar" aria-hidden="true">{match.partner.display_name[0]}</span><div><strong>{match.partner.display_name}</strong><p>Open your conversation</p></div><span>›</span>
        </Link>)}
        {!loading && !matches.length && <p className="muted">You’ll be able to message people after you match.</p>}
      </aside>
      <section className="message-panel">
        {active ? <>
          <div className="message-header"><span className="avatar" aria-hidden="true">{active.partner.display_name[0]}</span><div><h2>{active.partner.display_name}</h2><small className="muted">Matched {new Date(active.created_at).toLocaleDateString()}</small></div><Link className="button secondary" href="/sessions">Schedule a session</Link><button className="button secondary" type="button" onClick={() => void refresh()}>Refresh</button></div>
          <SafetyActions targetId={active.partner.id} matchId={active.id} onBlocked={() => window.location.assign("/matches")} />
          <div className="message-history">
            {cursor && <button className="text-button" type="button" onClick={() => void loadOlder()}>Load earlier messages</button>}
            {loading && <p className="muted" role="status">Loading conversation…</p>}
            {!loading && !messages.length && <p className="empty">Start with a hello and a skill you’d like to learn.</p>}
            {messages.map(message => <div key={message.id} className={`message ${message.mine ? "mine" : ""}`}><p>{message.body}</p><small>{new Date(message.created_at).toLocaleString()}</small></div>)}
          </div>
          <form className="message-compose" onSubmit={submit}><input aria-label="Message" placeholder="Write a message…" maxLength={2000} value={draft} onChange={event => setDraft(event.target.value)} /><button className="button" disabled={!draft.trim() || sending}>{sending ? "Sending…" : <>Send <span aria-hidden="true">↑</span></>}</button></form>
          {error && <p className="error-feedback" role="alert">{error}</p>}{notice && <p className="chat-note" role="status">{notice}</p>}
        </> : <div className="empty">{error && <p className="error-feedback" role="alert">{error}</p>}<h2>{loading ? "Loading conversations…" : selectedId ? "Conversation unavailable" : "Your next conversation starts here"}</h2><Link className="button" href="/discover">Find a partner</Link></div>}
      </section>
    </div>
  </>;
}
