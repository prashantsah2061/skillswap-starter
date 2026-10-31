"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useDemo, community } from "./demo-provider";
import type { Conversation, Message } from "@/lib/community/types";
import { Photo, Dialog } from "./ui";
import { ScheduleForm } from "./sessions";
import { useReducedEffects } from "@/components/auth/motion-preferences";
import { TypingDots } from "@/components/ui/motion";
const sorted = (rows: Message[]) =>
  Array.from(new Map(rows.map((m) => [m.id, m])).values()).sort(
    (a, b) =>
      a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  );
export function Messages({ selectedId }: { selectedId?: string }) {
  const { data } = useDemo();
  const [conversations, setConversations] = useState<Conversation[]>([]),
    [selected, setSelected] = useState<Conversation | null>(null),
    [messages, setMessages] = useState<Message[]>([]),
    [loadedMatch, setLoadedMatch] = useState(""),
    [text, setText] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [sending, setSending] = useState(false),
    [more, setMore] = useState(false),
    [moreConversations, setMoreConversations] = useState(false),
    [schedule, setSchedule] = useState(false),
    // Only messages that arrive while open animate, not loaded history.
    [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const retry = useRef<{ id: string; body: string; match: string } | null>(
      null,
    ),
    active = useRef(""),
    history = useRef<HTMLDivElement>(null),
    opened = useRef("");
  const reduced = useReducedEffects();
  const visible = messages.filter((m) => m.match_id === selected?.id);
  const lastId = visible.at(-1)?.id,
    lastMine = visible.at(-1)?.sender_id === data.userId;
  useEffect(() => {
    const el = history.current;
    if (!el || !lastId || loadedMatch !== selected?.id) return;
    const opening = opened.current !== loadedMatch;
    opened.current = loadedMatch;
    // Don't pull someone back down while they are reading older messages.
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (opening || atBottom || lastMine || sending)
      el.scrollTo({
        top: el.scrollHeight,
        behavior: opening || reduced ? "auto" : "smooth",
      });
  }, [lastId, lastMine, loadedMatch, selected?.id, sending, reduced]);
  useEffect(() => {
    let live = true;
    community<Conversation[]>({ op: "conversations" })
      .then((rows) => {
        if (live) {
          setConversations(rows);
          setMoreConversations(rows.length === 24);
          if (!selectedId) setSelected(rows[0] || null);
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [selectedId]);
  useEffect(() => {
    if (!selectedId) return;
    let live = true;
    community<Conversation | null>({ op: "conversation", match: selectedId })
      .then((r) => {
        if (live) setSelected(r);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [selectedId]);
  useEffect(() => {
    const id = selected?.id;
    if (!id) return;
    active.current = id;
    let live = true,
      running = false,
      first = true;
    let known = new Set<string>();
    async function reconcile() {
      if (running) return;
      running = true;
      try {
        let page = await community<Message[]>({ op: "messages", match: id! });
        let rows = [...page];
        // Refill every missed page on reconnect, even when more than 40 messages arrived.
        if (!first) {
          while (
            live &&
            page.length === 40 &&
            !page.some((m) => known.has(m.id))
          ) {
            const oldest = page.at(-1)!;
            page = await community<Message[]>({
              op: "messages",
              match: id!,
              before: oldest.created_at,
              cursor: oldest.id,
            });
            rows = [...rows, ...page];
          }
        }
        if (live) {
          if (first) setMessages(sorted(rows));
          else {
            const arrived = rows.filter((m) => !known.has(m.id));
            if (arrived.length)
              setFresh((old) => new Set([...old, ...arrived.map((m) => m.id)]));
            setMessages((old) => sorted([...old, ...rows]));
          }
          if (first) setMore(rows.length === 40);
          setLoadedMatch(id!);
          first = false;
          known = new Set([...known, ...rows.map((m) => m.id)]);
          setError("");
          if (rows[0] && document.visibilityState === "visible")
            await community(
              { op: "read", match: id!, message: rows[0].id },
              true,
            );
        }
      } catch (e) {
        if (live) setError((e as Error).message);
      } finally {
        running = false;
      }
    }
    void reconcile();
    const timer = setInterval(reconcile, 5000);
    const focus = () => void reconcile();
    window.addEventListener("focus", focus);
    window.addEventListener("online", focus);
    return () => {
      live = false;
      active.current = "";
      clearInterval(timer);
      window.removeEventListener("focus", focus);
      window.removeEventListener("online", focus);
    };
  }, [selected?.id]);
  useEffect(() => {
    let live = true,
      running = false;
    async function updatePreviews() {
      if (running) return;
      running = true;
      try {
        const rows = await community<Conversation[]>({ op: "conversations" });
        if (live)
          setConversations((old) =>
            Array.from(
              new Map(
                [
                  ...rows,
                  ...old.filter((c) => !rows.some((r) => r.id === c.id)),
                ].map((c) => [c.id, c]),
              ).values(),
            ).sort((a, b) => b.latest_at.localeCompare(a.latest_at)),
          );
      } catch (e) {
        if (live) setError((e as Error).message);
      } finally {
        running = false;
      }
    }
    const timer = setInterval(updatePreviews, 5000);
    window.addEventListener("focus", updatePreviews);
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener("focus", updatePreviews);
    };
  }, []);
  async function older() {
    if (!selected || !messages.length) return;
    try {
      const first = messages[0],
        rows = await community<Message[]>({
          op: "messages",
          match: selected.id,
          before: first.created_at,
          cursor: first.id,
        });
      setMessages((old) => sorted([...rows, ...old]));
      setMore(rows.length === 40);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function send(e: FormEvent) {
    e.preventDefault();
    if (!selected || !text.trim() || sending) return;
    const match = selected.id;
    const body = text.trim();
    if (
      !retry.current ||
      retry.current.body !== body ||
      retry.current.match !== match
    )
      retry.current = { id: crypto.randomUUID(), body, match };
    setSending(true);
    try {
      const row = await community<Message>(
        { op: "send", ...retry.current },
        true,
      );
      if (active.current === match) {
        setFresh((old) => new Set([...old, row.id]));
        setMessages((old) => sorted([...old, row]));
        setText("");
        setError("");
      }
      retry.current = null;
    } catch (e) {
      setError(
        (e as Error).message + " Your text is kept; send again to retry.",
      );
    } finally {
      setSending(false);
    }
  }
  async function loadConversations() {
    try {
      const rows = await community<Conversation[]>({
        op: "conversations",
        offset: String(conversations.length),
      });
      setConversations((old) => [...old, ...rows]);
      setMoreConversations(rows.length === 24);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <h1>Messages</h1>
      <p className="subtitle">Say hello. Find your rhythm. Learn together.</p>
      {error && <p role="alert">{error}</p>}
      {loading && <p>Loading conversations…</p>}
      <div className="messenger card">
        <aside className="conversation-list">
          <h2>Your conversations</h2>
          {conversations.map((c) => (
            <Link
              key={c.id}
              className={`conversation ${c.id === selected?.id ? "selected" : ""}`}
              href={`/messages/${c.id}`}
            >
              <Photo
                photo={c.member?.avatar_url || ""}
                alt={c.member?.display_name || ""}
              />
              <div>
                <strong>{c.member?.display_name}</strong>
                <p>{c.preview || "Start your skill swap"}</p>
                <small>
                  {new Date(c.latest_at).toLocaleString()}
                  {c.unread > 0 ? ` · ${c.unread} unread` : ""}
                </small>
              </div>
            </Link>
          ))}
          {!loading && !conversations.length && (
            <p>No conversations yet. Find a mutual match first.</p>
          )}
          {moreConversations && (
            <button onClick={loadConversations}>More conversations</button>
          )}
        </aside>
        <motion.section
          className="message-panel"
          key={selected?.id || "none"}
          initial={{ opacity: 0, x: reduced ? 0 : 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          {selected ? (
            <>
              <div className="message-header">
                <Photo
                  photo={selected.member?.avatar_url || ""}
                  alt={selected.member?.display_name || ""}
                />
                <h2>{selected.member?.display_name}</h2>
                <button className="button" onClick={() => setSchedule(true)}>
                  Schedule a session
                </button>
              </div>
              <div className="message-history" ref={history}>
                {more && <button onClick={older}>Load older messages</button>}
                {visible.map((m) => {
                  const mine = m.sender_id === data.userId;
                  return (
                    <motion.div
                      key={m.id}
                      className={`message ${mine ? "mine" : ""}`}
                      style={{ transformOrigin: mine ? "bottom right" : "bottom left" }}
                      initial={
                        fresh.has(m.id)
                          ? { opacity: 0, y: reduced ? 0 : 12, scale: reduced ? 1 : 0.97 }
                          : false
                      }
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.24, ease: "easeOut" }}
                    >
                      <p>{m.body}</p>
                      <small>{new Date(m.created_at).toLocaleString()}</small>
                    </motion.div>
                  );
                })}
                <AnimatePresence>
                  {sending && (
                    <motion.div
                      className="message mine"
                      aria-hidden="true"
                      initial={{ opacity: 0, y: reduced ? 0 : 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, transition: { duration: 0.08 } }}
                      transition={{ duration: 0.16 }}
                    >
                      <p>
                        <TypingDots />
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
                {loadedMatch !== selected.id ? (
                  <p role="status">Loading messages…</p>
                ) : (
                  !messages.length && <p>Start the conversation.</p>
                )}
              </div>
              <form className="message-compose" onSubmit={send}>
                <input
                  aria-label="Message"
                  maxLength={2000}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Write a message…"
                  disabled={sending}
                />
                <button
                  className="button"
                  disabled={
                    sending || !text.trim() || loadedMatch !== selected.id
                  }
                >
                  {sending ? "Sending…" : "Send"}
                </button>
              </form>
            </>
          ) : (
            <div className="empty">
              <h2>Select a conversation</h2>
              {selectedId && <p>This conversation is unavailable.</p>}
            </div>
          )}
        </motion.section>
      </div>
      <AnimatePresence>
        {schedule && selected && (
          <Dialog title="Schedule a session" onClose={() => setSchedule(false)}>
            <ScheduleForm
              partnerId={selected.id}
              onDone={() => setSchedule(false)}
            />
          </Dialog>
        )}
      </AnimatePresence>
    </>
  );
}
