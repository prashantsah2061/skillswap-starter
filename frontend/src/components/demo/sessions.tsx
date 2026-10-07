"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { partners } from "@/lib/frontend-data";
import { useDemo } from "./demo-provider";
import { Badge, Photo, Dialog } from "./ui";
export function ScheduleForm({
  partnerId,
  onDone,
}: {
  partnerId?: string;
  onDone: () => void;
}) {
  const { data, update } = useDemo();
  const [error, setError] = useState("");
  const matched = partners.filter((p) => data.matches.includes(p.id));
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const date = String(f.get("date")),
      time = String(f.get("time"));
    if (new Date(`${date}T${time}`).getTime() <= Date.now()) {
      setError("Choose a date and time in the future.");
      return;
    }
    update((d) => ({
      ...d,
      sessions: [
        ...d.sessions,
        {
          id: crypto.randomUUID(),
          partner: String(f.get("partner")),
          learn: String(f.get("learn")),
          teach: String(f.get("teach")),
          date,
          time,
          past: false,
        },
      ],
    }));
    onDone();
  }
  return (
    <form onSubmit={submit}>
      <p className="muted">
        Plan 30 minutes of learning + 30 minutes of teaching. Saved only in this
        browser.
      </p>
      <label>
        Partner
        <select
          name="partner"
          required
          defaultValue={partnerId || matched[0]?.id}
        >
          {matched.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <div className="form-grid">
        <label>
          You learn
          <input
            required
            name="learn"
            maxLength={60}
            defaultValue={data.profile.learns[0] || "Python"}
          />
        </label>
        <label>
          You teach
          <input
            required
            name="teach"
            maxLength={60}
            defaultValue={data.profile.teaches[0] || "Figma"}
          />
        </label>
        <label>
          Date
          <input
            required
            type="date"
            name="date"
            min={new Date().toLocaleDateString("en-CA")}
          />
        </label>
        <label>
          Time (your local time)
          <input required type="time" name="time" />
        </label>
      </div>
      {error && (
        <p role="alert" className="error-feedback">
          {error}
        </p>
      )}
      <button className="button lime full" disabled={!matched.length}>
        Add demo session
      </button>
      {!matched.length && <p>Find a demo match first.</p>}
    </form>
  );
}
export function Sessions() {
  const { data } = useDemo();
  const [tab, setTab] = useState("Upcoming");
  const [schedule, setSchedule] = useState(false);
  const [notice, setNotice] = useState(false);
  const sessions = data.sessions.filter((s) => s.past === (tab === "Past"));
  return (
    <>
      <div className="heading-row">
        <div>
          <p className="eyebrow">MAKE TIME TO GROW</p>
          <h1>Your sessions</h1>
          <p className="subtitle">
            A little teaching. A little learning. A lot of possibility.
          </p>
        </div>
        <button className="button lime" onClick={() => setSchedule(true)}>
          + Schedule a session
        </button>
      </div>
      {notice && (
        <p role="status" className="feedback">
          Your demo session was added locally. No invitation was sent.
        </p>
      )}
      <div className="tabs">
        {["Upcoming", "Past"].map((t) => (
          <button
            className={tab === t ? "active" : ""}
            aria-pressed={tab === t}
            key={t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="sessions-grid">
        {sessions.map((s) => {
          const p = partners.find((p) => p.id === s.partner);
          return (
            <article className="session-card card" key={s.id}>
              <div className="session-partner">
                <Photo photo={p?.photo || "maya"} alt="" />
                <div>
                  <h3>{p?.name || "Demo partner"}</h3>
                  <Badge tone={s.past ? "purple" : "mint"}>
                    {s.past ? "Completed demo" : "Upcoming demo"}
                  </Badge>
                </div>
              </div>
              <h2>
                {s.learn} × {s.teach}
              </h2>
              <p className="muted">
                ▣ &nbsp;{" "}
                {new Date(s.date + "T12:00").toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}{" "}
                · {s.time} (local time)
              </p>
              <div className="session-plan">
                <span>
                  You learn <strong>{s.learn}</strong>
                </span>
                <span>
                  You teach <strong>{s.teach}</strong>
                </span>
              </div>
              <p className="muted">60 minutes · Roles switch at halftime</p>
              <Link className="button full" href={`/sessions/${s.id}`}>
                {s.past ? "Revisit demo room" : "Open demo room"} →
              </Link>
            </article>
          );
        })}
      </div>
      {!sessions.length && (
        <div className="card empty">
          <h2>
            {tab === "Past"
              ? "No past sessions yet"
              : "Make your first learning plan"}
          </h2>
          <p>Schedule a demo session with a match to get started.</p>
          <button className="button" onClick={() => setSchedule(true)}>
            Schedule a session
          </button>
        </div>
      )}
      {schedule && (
        <Dialog title="Schedule a session" onClose={() => setSchedule(false)}>
          <ScheduleForm
            onDone={() => {
              setSchedule(false);
              setNotice(true);
            }}
          />
        </Dialog>
      )}
    </>
  );
}
