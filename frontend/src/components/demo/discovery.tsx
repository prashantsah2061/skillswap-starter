"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { partners, categories } from "@/lib/frontend-data";
import { useDemo } from "./demo-provider";
import { Badge, Photo, Dialog } from "./ui";
export function Discovery({ initialSkill = "" }: { initialSkill?: string }) {
  const { data, update } = useDemo();
  const [learningChoice, setLearning] = useState<string | null>(null);
  const [teachingChoice, setTeaching] = useState<string | null>(null);
  const learning =
    learningChoice ?? (initialSkill || data.profile.learns[0] || "");
  const teaching = teachingChoice ?? (data.profile.teaches[0] || "");
  const [reviewed, setReviewed] = useState<string[]>([]);
  const [direction, setDirection] = useState("");
  const [match, setMatch] = useState<string | null>(null);
  const start = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const available = partners.filter(
    (p) =>
      (!learning || p.teaches.includes(learning)) &&
      (!teaching || p.learns.includes(teaching)) &&
      !reviewed.includes(p.id),
  );
  const p = available[0];
  function decide(interested: boolean) {
    if (!p || direction) return;
    setDirection(interested ? "right" : "left");
    timer.current = setTimeout(() => {
      setReviewed((r) => [...r, p.id]);
      setDirection("");
      if (interested && p.mutual) {
        update((d) => ({
          ...d,
          matches: Array.from(new Set([...d.matches, p.id])),
        }));
        setMatch(p.id);
      }
    }, 280);
  }
  return (
    <>
      <div className="discovery-heading">
        <span className="eyebrow">BETTER TOGETHER</span>
        <h1>Meet your next skill partner</h1>
        <p className="subtitle">
          Swipe right to connect. Swipe left to keep exploring.
        </p>
        <div className="discovery-filters">
          <label className="chip selected">
            Learning:{" "}
            <select
              aria-label="Learning filter"
              value={learning}
              onChange={(e) => {
                setLearning(e.target.value);
                setReviewed([]);
              }}
            >
              <option value="">Any skill</option>
              {categories
                .flatMap((c) => c.skills)
                .map((s) => (
                  <option key={s}>{s}</option>
                ))}
            </select>
          </label>
          <label className="chip">
            Teaching:{" "}
            <select
              aria-label="Teaching filter"
              value={teaching}
              onChange={(e) => {
                setTeaching(e.target.value);
                setReviewed([]);
              }}
            >
              <option value="">Any skill</option>
              {data.profile.teaches.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="discovery-layout">
        <aside className="swap-intro card">
          <h2>A swap goes both ways</h2>
          <p>
            Teach what you know.
            <br />
            Learn what you’re curious about.
            <br />
            Grow a little, together.
          </p>
          <div className="swap-skill blue">
            <span>✦</span>
            <div>
              You teach
              <strong>
                {teaching || data.profile.teaches.join(", ") || "Add a skill"}
              </strong>
            </div>
          </div>
          <div className="swap-arrows">
            ➜<br />
            <b>⟵</b>
          </div>
          <div className="swap-skill green">
            <span>⌘</span>
            <div>
              You learn
              <strong>
                {learning || data.profile.learns.join(", ") || "Choose a skill"}
              </strong>
            </div>
          </div>
          <Link className="text-button" href="/profile">
            Edit your skills →
          </Link>
        </aside>
        <div className="profile-stack">
          {p ? (
            <>
              <div className="stack-back one" />
              <div className="stack-back two" />
              <article
                className={`partner-card card ${direction}`}
                onTouchStart={(e) => {
                  start.current = e.touches[0].clientX;
                }}
                onTouchEnd={(e) => {
                  if (start.current !== null) {
                    const delta = e.changedTouches[0].clientX - start.current;
                    if (Math.abs(delta) > 65) decide(delta > 0);
                    start.current = null;
                  }
                }}
              >
                <Photo
                  photo={p.photo}
                  alt={`${p.name}, fictional demo partner`}
                  className="partner-photo"
                />
                <div className="partner-body">
                  <h2>{p.name}</h2>
                  <p className="location">⌖ &nbsp; {p.city}</p>
                  <p>{p.bio}</p>
                  <div className="partner-skills">
                    <div>
                      <strong>Can teach you</strong>
                      <div>
                        {p.teaches.map((s) => (
                          <Badge key={s}>{s}</Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <strong>Wants to learn</strong>
                      <div>
                        {p.learns.map((s) => (
                          <Badge tone="mint" key={s}>
                            {s}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="decision-buttons">
                    <button
                      onClick={() => decide(false)}
                      disabled={!!direction}
                    >
                      <span aria-hidden="true">×</span>Pass
                    </button>
                    <button onClick={() => decide(true)} disabled={!!direction}>
                      <span aria-hidden="true">♥</span>Interested
                    </button>
                  </div>
                </div>
              </article>
            </>
          ) : (
            <div className="card empty">
              <span className="empty-symbol">✦</span>
              <h2>
                {reviewed.length
                  ? "You’re all caught up!"
                  : "No partners for this combination"}
              </h2>
              <p>
                Try a different skill pairing or revisit these demo profiles.
              </p>
              <button
                className="button"
                onClick={() => {
                  setReviewed([]);
                  setLearning("");
                  setTeaching("");
                }}
              >
                Explore all partners
              </button>
              <Link className="text-button" href="/matches">
                View your matches →
              </Link>
            </div>
          )}
          <p className="demo-caption">
            ⓘ Fictional profiles. Mutual interest is predefined for this demo.
          </p>
        </div>
      </div>
      {match && (
        <Dialog title="It’s a skill match!" onClose={() => setMatch(null)}>
          <div className="match-symbol">↔</div>
          <p>
            You and {partners.find((p) => p.id === match)?.name} can learn from
            each other.
          </p>
          <p className="muted">
            This match uses predefined demo interest. No real person was
            notified.
          </p>
          <Link className="button lime full" href={`/messages/${match}`}>
            Start a demo conversation →
          </Link>
          <button className="text-button full" onClick={() => setMatch(null)}>
            Keep exploring
          </button>
        </Dialog>
      )}
    </>
  );
}
export function Matches() {
  const { data } = useDemo();
  const matched = partners.filter((p) => data.matches.includes(p.id));
  return (
    <>
      <div className="heading-row">
        <div>
          <p className="eyebrow">YOUR LEARNING CIRCLE</p>
          <h1>Your matches</h1>
          <p className="subtitle">Good things start with a shared curiosity.</p>
        </div>
        <Link className="button lime" href="/discover">
          Find a partner →
        </Link>
      </div>
      <div className="matches-grid">
        {matched.map((p) => (
          <article key={p.id} className="card match-card">
            <Photo photo={p.photo} alt={p.name} />
            <div>
              <Badge tone="mint">Demo match</Badge>
              <h2>{p.name}</h2>
              <p className="muted">{p.city}</p>
              <p>{p.bio}</p>
              <div>
                {p.teaches.map((s) => (
                  <Badge key={s}>{s}</Badge>
                ))}
              </div>
              <Link className="button full" href={`/messages/${p.id}`}>
                Open conversation →
              </Link>
            </div>
          </article>
        ))}
      </div>
      {!matched.length && (
        <div className="card empty">
          <h2>Your next connection is waiting</h2>
          <p>Show interest in a partner to try a demo match.</p>
          <Link className="button" href="/discover">
            Discover partners
          </Link>
        </div>
      )}
    </>
  );
}
