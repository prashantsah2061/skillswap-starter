"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { partners } from "@/lib/frontend-data";
import { useDemo } from "./demo-provider";
import { Photo, Dialog } from "./ui";
import { ScheduleForm } from "./sessions";
export function Messages({ selectedId }: { selectedId?: string }) {
  const { data, update } = useDemo();
  const [text, setText] = useState("");
  const [schedule, setSchedule] = useState(false);
  const [notice, setNotice] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const conversations = partners.filter((p) => data.matches.includes(p.id));
  const selected =
    conversations.find((p) => p.id === selectedId) ||
    (!selectedId ? conversations[0] : undefined);
  const messages = selected ? data.messages[selected.id] || [] : [];
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length, selected?.id]);
  function send(e: FormEvent) {
    e.preventDefault();
    if (!selected || !text.trim()) return;
    const message = {
      id: crypto.randomUUID(),
      text: text.trim(),
      mine: true,
      time: new Date().toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
    };
    update((d) => ({
      ...d,
      messages: {
        ...d.messages,
        [selected.id]: [...(d.messages[selected.id] || []), message],
      },
    }));
    setText("");
    setNotice("Message added to this local demo conversation.");
  }
  return (
    <>
      <h1>Messages</h1>
      <p className="subtitle">Say hello. Find your rhythm. Learn together.</p>
      <div className="messenger card">
        <aside className="conversation-list">
          <h2>Your conversations</h2>
          {conversations.map((p) => (
            <Link
              href={`/messages/${p.id}`}
              className={`conversation ${p.id === selected?.id ? "selected" : ""}`}
              key={p.id}
            >
              <Photo photo={p.photo} alt="" />
              <div>
                <strong>{p.name}</strong>
                <p>
                  {data.messages[p.id]?.at(-1)?.text || "Start your skill swap"}
                </p>
              </div>
              <span>›</span>
            </Link>
          ))}
          {!conversations.length && (
            <p className="muted">Find a match to start a demo conversation.</p>
          )}
        </aside>
        <section className="message-panel">
          {selected ? (
            <>
              <div className="message-header">
                <Photo photo={selected.photo} alt="" />
                <div>
                  <h2>{selected.name}</h2>
                  <small className="muted">Fictional demo partner</small>
                </div>
                <button
                  className="button secondary"
                  onClick={() => setSchedule(true)}
                >
                  Schedule a session
                </button>
              </div>
              <div className="message-history">
                <div className="chat-date">
                  Demo conversation · Local messages only
                </div>
                {messages.map((m) => (
                  <div key={m.id} className={`message ${m.mine ? "mine" : ""}`}>
                    <p>{m.text}</p>
                    <small>
                      {m.time} {m.mine ? "· Saved locally" : ""}
                    </small>
                  </div>
                ))}
                {!messages.length && (
                  <p className="empty">
                    Start with a hello and a skill you’d like to learn.
                  </p>
                )}
                <div ref={end} />
              </div>
              <form className="message-compose" onSubmit={send}>
                <input
                  aria-label="Message"
                  placeholder="Write a demo message…"
                  maxLength={2000}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
                <button className="button" disabled={!text.trim()}>
                  Send <span aria-hidden="true">↑</span>
                </button>
              </form>
              <p className="chat-note" role="status">
                {notice ||
                  "Demo only. Messages are saved locally and are not delivered to anyone."}
              </p>
            </>
          ) : (
            <div className="empty">
              <h2>
                {selectedId
                  ? "Conversation unavailable"
                  : "Your next conversation starts here"}
              </h2>
              <Link className="button" href="/discover">
                Find a partner
              </Link>
            </div>
          )}
        </section>
      </div>
      {schedule && selected && (
        <Dialog title="Schedule a session" onClose={() => setSchedule(false)}>
          <ScheduleForm
            partnerId={selected.id}
            onDone={() => {
              setSchedule(false);
              setNotice("Demo session added locally. View it in Sessions.");
            }}
          />
        </Dialog>
      )}
    </>
  );
}
