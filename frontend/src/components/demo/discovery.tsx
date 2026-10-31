"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { community, useDemo } from "./demo-provider";
import type { Member, Conversation } from "@/lib/community/types";
import { AnimatePresence } from "motion/react";
import { Photo, Badge, Dialog } from "./ui";
import { MatchBurst, Reveal, SwipeCard } from "@/components/ui/motion";
export function Discovery({ initialSkill = "" }: { initialSkill?: string }) {
  const { data, refresh } = useDemo();
  const [skill, setSkill] = useState(
      data.skills.find(
        (s) => s.name.toLowerCase() === initialSkill.toLowerCase(),
      )?.id || "",
    ),
    [learning, setLearning] = useState(""),
    [category, setCategory] = useState(""),
    [city, setCity] = useState(""),
    [search, setSearch] = useState("");
  const [members, setMembers] = useState<Member[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [more, setMore] = useState(false),
    [busy, setBusy] = useState(false),
    [match, setMatch] = useState(""),
    // Kept after a decision so the removed card knows which way to leave.
    [direction, setDirection] = useState(0),
    [pending, setPending] = useState("");
  const filters = { op: "discover", skill, learning, category, city, search };
  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      setLoading(true);
      community<Member[]>({
        op: "discover",
        skill,
        learning,
        category,
        city,
        search,
      })
        .then((rows) => {
          if (live) {
            setDirection(0);
            setMembers(rows);
            setMore(rows.length === 24);
            setError("");
          }
        })
        .catch((e) => {
          if (live) setError(e.message);
        })
        .finally(() => {
          if (live) setLoading(false);
        });
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [skill, learning, category, city, search]);
  async function loadMore() {
    setLoading(true);
    try {
      const rows = await community<Member[]>({
        ...filters,
        after: members.at(-1)?.id || "",
      });
      setMembers((old) => [...old, ...rows]);
      setMore(rows.length === 24);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  const p = members[0];
  async function decide(interested: boolean) {
    if (!p || busy) return;
    setBusy(true);
    setDirection(interested ? 1 : -1);
    setPending(p.id);
    setError("");
    try {
      const id = await community<string | null>(
        { op: "swipe", target: p.id, decision: interested ? "like" : "pass" },
        true,
      );
      setMembers((old) => old.filter((x) => x.id !== p.id));
      if (id) {
        setMatch(id);
        await refresh();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setPending("");
    }
  }
  return (
    <>
      <div className="discovery-heading">
        <span className="eyebrow">BETTER TOGETHER</span>
        <h1>Meet your next skill partner</h1>
        <p className="subtitle">Teach what you know. Learn something new.</p>
        <div className="discovery-filters">
          <label className="chip">
            Learning
            <select value={skill} onChange={(e) => setSkill(e.target.value)}>
              <option value="">Any skill</option>
              {data.skills.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="chip">
            Teaching
            <select
              value={learning}
              onChange={(e) => setLearning(e.target.value)}
            >
              <option value="">Any skill</option>
              {data.skills.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="chip">
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All fields</option>
              {data.categories.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <input
            aria-label="Search members"
            placeholder="Search names or bio"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <input
            aria-label="Location"
            placeholder="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
        </div>
      </div>
      {error && (
        <p role="alert">
          {error}
          <button onClick={() => loadMore()}>Retry</button>
        </p>
      )}
      {loading && <p role="status">Loading members…</p>}
      <div className="discovery-layout">
        <Reveal as="aside" className="swap-intro card">
          <h2>A swap goes both ways</h2>
          <p>Share your experience and explore every field.</p>
          <Link className="text-button" href="/profile">
            Edit your skills →
          </Link>
          <Link className="text-button" href="/matches">
            Your matches →
          </Link>
        </Reveal>
        <div className="profile-stack">
          {p && (
            <>
              <div className="stack-back one" />
              <div className="stack-back two" />
            </>
          )}
          <AnimatePresence mode="popLayout" custom={direction}>
            {p && (
              <SwipeCard
                key={p.id}
                className="partner-card card"
                direction={direction}
                pending={pending === p.id}
                disabled={busy}
                onSwipe={(right) => void decide(right)}
              >
                <Photo
                  photo=""
                  alt={p.display_name}
                  className="partner-photo"
                />
                <div className="partner-body">
                  <h2>
                    <Link href={`/users/${p.id}`} draggable={false}>
                      {p.display_name}
                    </Link>
                  </h2>
                  <p className="location">{p.city}</p>
                  <p>{p.bio}</p>
                  <div className="partner-skills">
                    {(["teach", "learn"] as const).map((d) => (
                      <div key={d}>
                        <strong>
                          {d === "teach" ? "Can teach" : "Wants to learn"}
                        </strong>
                        <div>
                          {p.user_skills
                            ?.filter((s) => s.direction === d)
                            .map((s) => (
                              <Badge
                                key={s.skill_id}
                                tone={d === "teach" ? "blue" : "mint"}
                              >
                                {
                                  data.skills.find((k) => k.id === s.skill_id)
                                    ?.name
                                }{" "}
                                · {s.level}
                              </Badge>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="decision-buttons">
                    <button disabled={busy} onClick={() => decide(false)}>
                      × Pass
                    </button>
                    <button disabled={busy} onClick={() => decide(true)}>
                      ♥ Interested
                    </button>
                  </div>
                </div>
              </SwipeCard>
            )}
          </AnimatePresence>
          {!p && !loading && !error && (
            <div className="card empty">
              <h2>No more members for these filters</h2>
              <p>
                Try other skills or locations, or invite someone to join
                SkillSwap.
              </p>
              <button
                className="button"
                onClick={() => {
                  setSkill("");
                  setLearning("");
                  setCategory("");
                  setCity("");
                  setSearch("");
                }}
              >
                Clear filters
              </button>
            </div>
          )}
          {more && (
            <button className="button" disabled={loading} onClick={loadMore}>
              Load more members
            </button>
          )}
        </div>
      </div>
      <AnimatePresence>
        {match && (
          <Dialog
            title="It’s a skill match!"
            icon={<MatchBurst />}
            onClose={() => setMatch("")}
          >
            <p>You both expressed interest. Start your conversation.</p>
            <Link className="button lime" href={`/messages/${match}`}>
              Open conversation →
            </Link>
          </Dialog>
        )}
      </AnimatePresence>
    </>
  );
}
export function Matches() {
  const [rows, setRows] = useState<Conversation[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [more, setMore] = useState(false);
  useEffect(() => {
    let live = true;
    community<Conversation[]>({ op: "conversations" })
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
  }, []);
  async function load() {
    setLoading(true);
    try {
      const r = await community<Conversation[]>({
        op: "conversations",
        offset: String(rows.length),
      });
      setRows((old) => [...old, ...r]);
      setMore(r.length === 24);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      <div className="heading-row">
        <div>
          <p className="eyebrow">YOUR LEARNING CIRCLE</p>
          <h1>Your matches</h1>
        </div>
        <Link href="/discover" className="button lime">
          Find a partner →
        </Link>
      </div>
      {loading && <p>Loading matches…</p>}
      {error && (
        <p role="alert">
          {error}
          <button onClick={load}>Retry</button>
        </p>
      )}
      <div className="matches-grid">
        {rows.map((r, index) => (
          <Reveal as="article" className="card match-card" key={r.id} index={index} lift>
            <Photo photo="" alt={r.member?.display_name || ""} />
            <div>
              <Badge tone="mint">Mutual match</Badge>
              <h2>{r.member?.display_name}</h2>
              <p>{r.member?.city}</p>
              <p>{r.member?.bio}</p>
              <Link href={`/messages/${r.id}`} className="button full">
                Open conversation →
              </Link>
              <Link href={`/users/${r.member?.id}`} className="text-button">
                View profile
              </Link>
            </div>
          </Reveal>
        ))}
      </div>
      {!loading && !error && !rows.length && (
        <div className="card empty">
          <h2>No matches yet</h2>
          <p>A match appears when you both like each other.</p>
        </div>
      )}
      {more && (
        <button disabled={loading} onClick={load}>
          Load more matches
        </button>
      )}
    </>
  );
}
