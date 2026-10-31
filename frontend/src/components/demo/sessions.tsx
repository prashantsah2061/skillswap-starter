"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { AnimatePresence } from "motion/react";
import { useDemo, community } from "./demo-provider";
import type { Session, Conversation } from "@/lib/community/types";
import { Badge, Dialog } from "./ui";
export function ScheduleForm({
  partnerId,
  onDone,
}: {
  partnerId?: string;
  onDone: () => void;
}) {
  const { data, refresh } = useDemo();
  const [matches, setMatches] = useState<Conversation[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [more, setMore] = useState(false),
    [loadingMatches, setLoadingMatches] = useState(true);
  const requestId = useRef(crypto.randomUUID());
  const pageOffset = useRef(0);
  const [selectedMatch, setSelectedMatch] = useState(partnerId || "");
  useEffect(() => {
    let live = true;
    Promise.all([
      community<Conversation[]>({ op: "conversations" }),
      partnerId
        ? community<Conversation | null>({
            op: "conversation",
            match: partnerId,
          })
        : Promise.resolve(null),
    ])
      .then(([rows, chosen]) => {
        if (live) {
          setMore(rows.length === 24);
          pageOffset.current = rows.length;
          setMatches(
            chosen && !rows.some((r) => r.id === chosen.id)
              ? [chosen, ...rows]
              : rows,
          );
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoadingMatches(false);
      });
    return () => {
      live = false;
    };
  }, [partnerId]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const f = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const start = new Date(`${f.get("date")}T${f.get("time")}`);
      if (!Number.isFinite(start.getTime()) || start.getTime() <= Date.now())
        throw new Error("Choose a future local date and time.");
      await community(
        {
          op: "propose",
          id: requestId.current,
          match: String(f.get("partner")),
          topic: String(f.get("topic")),
          start: start.toISOString(),
          duration: Number(f.get("duration")),
          notes: String(f.get("notes")),
          url: String(f.get("url")),
        },
        true,
      );
      await refresh();
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function load() {
    try {
      const rows = await community<Conversation[]>({
        op: "conversations",
        offset: String(pageOffset.current),
      });
      setMatches((old) => [
        ...old,
        ...rows.filter((r) => !old.some((x) => x.id === r.id)),
      ]);
      setMore(rows.length === 24);
      pageOffset.current += rows.length;
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <form onSubmit={submit}>
      <p className="muted">
        Propose a time in your local timezone. Your partner can accept or
        decline.
      </p>
      <label>
        Partner
        <select
          required
          name="partner"
          value={selectedMatch}
          onChange={(e) => setSelectedMatch(e.target.value)}
        >
          <option value="">Choose a match</option>
          {matches.map((m) => (
            <option key={m.id} value={m.id}>
              {m.member?.display_name}
            </option>
          ))}
        </select>
      </label>
      {more && (
        <button type="button" onClick={load}>
          Load more matches
        </button>
      )}
      <label>
        Session topic
        <input
          required
          name="topic"
          maxLength={160}
          defaultValue={
            data.skills.find(
              (s) =>
                s.id ===
                data.selections.find((x) => x.direction === "learn")?.skill_id,
            )?.name || ""
          }
        />
      </label>
      <div className="form-grid">
        <label>
          Date
          <input required name="date" type="date" />
        </label>
        <label>
          Time (local)
          <input required name="time" type="time" />
        </label>
        <label>
          Duration (minutes)
          <input
            required
            name="duration"
            type="number"
            min={1}
            max={480}
            defaultValue={60}
          />
        </label>
      </div>
      <label>
        Notes
        <textarea name="notes" maxLength={2000} />
      </label>
      <label>
        Meeting link (optional, HTTPS)
        <input name="url" type="url" maxLength={2000} />
      </label>
      {error && <p role="alert">{error}</p>}
      <button className="button lime full" disabled={busy || !matches.length}>
        {busy ? "Saving…" : "Propose session"}
      </button>
      {loadingMatches ? (
        <p role="status">Loading matches…</p>
      ) : (
        !error &&
        !matches.length && <p>A mutual match is needed to schedule.</p>
      )}
    </form>
  );
}
function useClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
export function SessionDetails({
  session,
  onChange,
}: {
  session: Session;
  onChange: () => void;
}) {
  const { data, refresh } = useDemo();
  const now = useClock();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function transition(status: string) {
    setBusy(true);
    try {
      await community({ op: "transition", id: session.id, status }, true);
      await refresh();
      onChange();
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const actions: string[] = [];
  if (session.status === "pending" && session.proposer_id !== data.userId)
    actions.push("accepted", "declined");
  if (["pending", "accepted"].includes(session.status))
    actions.push("cancelled");
  if (
    session.status === "accepted" &&
    new Date(session.starts_at).getTime() + session.duration_minutes * 60000 <=
      now
  )
    actions.push("completed");
  return (
    <article className="session-card card">
      <Badge tone="mint">{session.status}</Badge>
      <h2>{session.topic}</h2>
      <p>
        {session.partner?.display_name || "Your match"} ·{" "}
        {session.proposer_id === data.userId
          ? "You proposed"
          : "Partner proposed"}
      </p>
      <p>
        {new Date(session.starts_at).toLocaleString()} ·{" "}
        {session.duration_minutes} minutes
      </p>
      <p>{session.notes}</p>
      {session.meeting_url && (
        <a
          className="button"
          href={session.meeting_url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open meeting link
        </a>
      )}
      <Link className="text-button" href={`/messages/${session.match_id}`}>
        Conversation →
      </Link>
      <div className="decision-buttons">
        {actions.map((status) => (
          <button
            disabled={busy}
            key={status}
            onClick={() => transition(status)}
          >
            {
              (
                {
                  accepted: "Accept",
                  declined: "Decline",
                  cancelled: "Cancel",
                  completed: "Mark completed",
                } as Record<string, string>
              )[status]
            }
          </button>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
    </article>
  );
}
export function Sessions() {
  const [rows, setRows] = useState<Session[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [more, setMore] = useState(false),
    [schedule, setSchedule] = useState(false),
    [tab, setTab] = useState("Upcoming");
  async function load(append = false) {
    setLoading(true);
    try {
      const next = await community<Session[]>({
        op: "sessions",
        history: String(tab === "History"),
        offset: String(append ? rows.length : 0),
      });
      setRows((old) => (append ? [...old, ...next] : next));
      setMore(next.length === 24);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let live = true;
    community<Session[]>({ op: "sessions", history: String(tab === "History") })
      .then((r) => {
        if (live) {
          setRows(r);
          setMore(r.length === 24);
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
  }, [tab]);
  return (
    <>
      <div className="heading-row">
        <div>
          <p className="eyebrow">MAKE TIME TO GROW</p>
          <h1>Your sessions</h1>
        </div>
        <button className="button lime" onClick={() => setSchedule(true)}>
          + Schedule a session
        </button>
      </div>
      <div className="tabs">
        {["Upcoming", "History"].map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => {
              if (t !== tab) {
                setLoading(true);
                setError("");
                setRows([]);
                setMore(false);
                setTab(t);
              }
            }}
          >
            {t}
          </button>
        ))}
      </div>
      {loading && <p>Loading sessions…</p>}
      {error && (
        <p role="alert">
          {error}
          <button onClick={() => load()}>Retry</button>
        </p>
      )}
      <div className="sessions-grid">
        {rows.map((s) => (
          <div key={s.id}>
            <SessionDetails session={s} onChange={() => load()} />
            <Link href={`/sessions/${s.id}`}>Session details →</Link>
          </div>
        ))}
      </div>
      {!loading && !error && !rows.length && (
        <div className="empty card">
          <h2>No {tab.toLowerCase()} sessions yet</h2>
          <p>Make a learning plan with a match.</p>
        </div>
      )}
      {more && (
        <button disabled={loading} onClick={() => load(true)}>
          Load more sessions
        </button>
      )}
      <AnimatePresence>
        {schedule && (
          <Dialog title="Schedule a session" onClose={() => setSchedule(false)}>
            <ScheduleForm
              onDone={() => {
                setSchedule(false);
                void load();
              }}
            />
          </Dialog>
        )}
      </AnimatePresence>
    </>
  );
}
