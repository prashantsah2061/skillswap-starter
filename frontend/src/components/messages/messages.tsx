"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loadMatches, loadMessages, loadRealtimeToken, sendMessage, type MatchSummary, type PersistedMessage } from "@/lib/discovery/client";
import { createClient } from "@/lib/supabase/client";
import { SafetyActions } from "@/components/safety/safety-actions";

type RealtimeStatus = "connecting" | "connected" | "reconnecting" | "offline";

function mergeMessages(...groups: PersistedMessage[][]) {
  const byId = new Map<string, PersistedMessage>();
  groups.flat().forEach(message => byId.set(message.id, message));
  return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}

export function Messages({ selectedId }: { selectedId?: string }) {
  const router = useRouter();
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [messages, setMessages] = useState<PersistedMessage[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("connecting");
  const active = useMemo(() => selectedId ? matches.find(match => match.id === selectedId) : matches[0], [matches, selectedId]);
  const loadingConversation = Boolean(active && loadedFor !== active.id && !error);

  useEffect(() => {
    const controller = new AbortController();
    loadMatches(controller.signal).then(result => {
      if (!controller.signal.aborted) setMatches(result.data);
    }).catch(reason => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Conversations could not be loaded.");
    })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    setLoadedFor(null); setMessages([]); setCursor(null); setError("");
    loadMessages(active.id, null, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setMessages(current => mergeMessages(result.data, current)); setCursor(result.meta.next_cursor); setLoadedFor(active.id); setError("");
    }).catch(reason => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Messages could not be loaded.");
    })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [active?.id]);

  useEffect(() => {
    if (!active) { setRealtimeStatus("offline"); return; }
    const matchId = active.id;
    const client = createClient();
    let channel: ReturnType<typeof client.channel> | null = null;
    let stopped = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let tokenTimer: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = 1000;
    let connecting = false;

    const clearTimers = () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (tokenTimer) clearTimeout(tokenTimer);
      retryTimer = null; tokenTimer = null;
    };

    const scheduleRetry = () => {
      if (stopped || retryTimer) return;
      setRealtimeStatus("reconnecting");
      retryTimer = setTimeout(() => {
        retryTimer = null;
        void connect();
      }, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 15000);
    };

    const connect = async () => {
      if (stopped || connecting) return;
      connecting = true;
      if (tokenTimer) clearTimeout(tokenTimer);
      tokenTimer = null;
      try {
        const { data } = await loadRealtimeToken();
        if (stopped) return;
        await client.realtime.setAuth(data.access_token);
        if (stopped) return;
        if (channel) await client.removeChannel(channel);
        channel = client.channel(`messages:${matchId}`).on("postgres_changes", {
          event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${matchId}`,
        }, payload => {
          const row = payload.new as Omit<PersistedMessage, "mine">;
          if (!row?.id || row.match_id !== matchId || !row.sender_id || !row.created_at || typeof row.body !== "string") return;
          setMessages(current => mergeMessages(current, [{ ...row, mine: row.sender_id === data.user_id }]));
        }).subscribe(status => {
          if (stopped) return;
          if (status === "SUBSCRIBED") {
            retryDelay = 1000;
            if (retryTimer) clearTimeout(retryTimer);
            retryTimer = null;
            setRealtimeStatus("connected");
            // Reconcile any brief disconnect gap and initial-history race.
            void loadMessages(matchId).then(page => {
              if (!stopped) setMessages(current => mergeMessages(current, page.data));
            }).catch(() => { /* The visible Refresh action remains the fallback. */ });
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            scheduleRetry();
          }
        });
        if (data.expires_at) {
          const refreshIn = Math.max(30000, data.expires_at * 1000 - Date.now() - 60000);
          tokenTimer = setTimeout(() => { void connect(); }, refreshIn);
        }
      } catch {
        if (!stopped) scheduleRetry();
      } finally {
        connecting = false;
      }
    };

    setRealtimeStatus("connecting");
    void connect();
    return () => {
      stopped = true;
      clearTimers();
      if (channel) void client.removeChannel(channel);
    };
  }, [active?.id]);

  async function refresh() {
    if (!active) return;
    setError("");
    try {
      const page = await loadMessages(active.id);
      setMessages(current => mergeMessages(current, page.data));
      setNotice("Conversation refreshed.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Messages could not be refreshed."); }
  }

  async function loadOlder() {
    if (!active || !cursor) return;
    setError("");
    try {
      const page = await loadMessages(active.id, cursor);
      setMessages(current => mergeMessages(current, page.data)); setCursor(page.meta.next_cursor);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Earlier messages could not be loaded."); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!active || !draft.trim() || sending) return;
    setSending(true); setError(""); setNotice("");
    try {
      const result = await sendMessage(active.id, draft.trim());
      setMessages(current => mergeMessages(current, [result.data])); setDraft(""); setNotice("Message sent.");
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
        {!loading && !matches.length && <p className="muted">Your conversations will appear here.</p>}
      </aside>
      <section className="message-panel">
        {active ? <>
          <div className="message-header"><span className="avatar" aria-hidden="true">{active.partner.display_name[0]}</span><div><h2>{active.partner.display_name}</h2><small className="muted">Matched {new Date(active.created_at).toLocaleDateString()}</small><small className="muted" role="status" aria-live="polite">{realtimeStatus === "connected" ? "Live updates on" : realtimeStatus === "connecting" ? "Connecting to live updates…" : realtimeStatus === "reconnecting" ? "Reconnecting…" : "Live updates unavailable"}</small></div><Link className="button secondary" href="/sessions">Schedule a session</Link><button className="button secondary" type="button" onClick={() => void refresh()}>Refresh</button></div>
          <SafetyActions targetId={active.partner.id} matchId={active.id} onBlocked={() => router.push("/matches")} />
          <div className="message-history">
            {loadedFor === active.id && cursor && <button className="text-button" type="button" onClick={() => void loadOlder()}>Load earlier messages</button>}
            {(loading || loadingConversation) && <p className="muted" role="status">Loading conversation…</p>}
            {!loading && loadedFor === active.id && !messages.length && <p className="empty">Start with a hello and a skill you’d like to learn.</p>}
            {loadedFor === active.id && messages.map(message => <div key={message.id} className={`message ${message.mine ? "mine" : ""}`}><p>{message.body}</p><small>{new Date(message.created_at).toLocaleString()}</small></div>)}
          </div>
          <form className="message-compose" onSubmit={submit}><input aria-label="Message" placeholder="Write a message…" maxLength={2000} value={draft} onChange={event => setDraft(event.target.value)} /><button className="button" disabled={!draft.trim() || sending}>{sending ? "Sending…" : <>Send <span aria-hidden="true">↑</span></>}</button></form>
          {error && <p className="error-feedback" role="alert">{error}</p>}{notice && <p className="chat-note" role="status">{notice}</p>}
        </> : <div className="empty">{error && <p className="error-feedback" role="alert">{error}</p>}<h2>{loading ? "Loading conversations…" : selectedId ? "Conversation unavailable" : "Your conversations will appear here."}</h2><Link className="button" href="/discover">Find a partner</Link></div>}
      </section>
    </div>
  </>;
}
