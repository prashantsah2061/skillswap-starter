"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { DiscoverResponse, PendingInterest } from "@shared/discovery";
import { loadDiscovery, loadPendingInterests, loadPublicOnboarding, recordSwipe, PublicApiError, type PublicSkill, type PublicSelection } from "@/lib/discovery/client";
import { SkillCard } from "./skill-card";

export function Discovery() {
  const [result, setResult] = useState<DiscoverResponse | null>(null);
  const [catalog, setCatalog] = useState<PublicSkill[]>([]);
  const [selections, setSelections] = useState<PublicSelection[]>([]);
  const [pending, setPending] = useState<PendingInterest[]>([]);
  const [skillId, setSkillId] = useState("");
  const [mode, setMode] = useState<"" | "online" | "in_person">("");
  const [includeSkipped, setIncludeSkipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authPath, setAuthPath] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "pending" | "matched"; name: string; matchId?: string } | null>(null);
  const active = useRef<AbortController | null>(null);
  const filters = { skillId: skillId || undefined, mode: mode || undefined, includeSkipped };

  function fetchPage(controller: AbortController, cursor: string | null) {
    return loadDiscovery(cursor, controller.signal, filters).then(page => {
      if (controller.signal.aborted) return;
      setResult(previous => ({ ...page, data: cursor && !page.meta.reason ?
        [...(previous?.data || []), ...page.data.filter(row => !previous?.data.some(old => old.id === row.id))] : page.data }));
    }).catch(reason => {
      if (controller.signal.aborted) return;
      setError(reason instanceof Error ? reason.message : "Partners could not be loaded. Please try again.");
      if (reason instanceof PublicApiError) {
        setAuthPath(reason.status === 401 ? "/login" : reason.code === "MFA_REQUIRED" ? "/mfa" : null);
        if (reason.status === 401 || reason.status === 403 || reason.code === "CURSOR_EXPIRED") setResult(null);
      }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
  }

  function reload(cursor: string | null = null) {
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    setLoading(true); setError(""); setAuthPath(null);
    void fetchPage(controller, cursor);
  }

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([loadPublicOnboarding(controller.signal).then(value => {
      setCatalog(value.catalog); setSelections(value.selections);
    }), loadPendingInterests(controller.signal).then(value => setPending(value.data))]).catch(() => {
      // Discovery has its own retry state; optional filter and pending data can
      // fail independently without making a valid recommendation feed disappear.
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    void fetchPage(controller, null);
    return () => active.current?.abort();
  // Restart from the top when explicit discovery filters change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skillId, mode, includeSkipped]);

  const reason = result?.meta.reason;
  const reciprocal = result?.data.filter(row => row.recommendation_type === "reciprocal") ?? [];
  const oneWay = result?.data.filter(row => row.recommendation_type === "one_way") ?? [];

  async function decide(profileId: string, decision: "like" | "pass") {
    if (!result || busyId) return;
    setBusyId(profileId); setError(""); setNotice(null);
    try {
      const response = await recordSwipe(profileId, decision);
      const profile = result.data.find(row => row.id === profileId);
      setResult(current => current ? { ...current, data: current.data.filter(row => row.id !== profileId) } : current);
      if (decision === "like" && profile) {
        if (response.data.matched && response.data.match_id) setNotice({ kind: "matched", name: profile.display_name, matchId: response.data.match_id });
        else {
          setNotice({ kind: "pending", name: profile.display_name });
          setPending(current => [{ created_at: new Date().toISOString(), partner: profile }, ...current.filter(item => item.partner.id !== profile.id)]);
        }
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Your decision could not be saved. Please try again.");
      if (reason instanceof PublicApiError) setAuthPath(reason.status === 401 ? "/login" : reason.code === "MFA_REQUIRED" ? "/mfa" : null);
    } finally { setBusyId(null); }
  }

  function clearFilters() { setSkillId(""); setMode(""); }

  return <>
    <div className="discovery-heading"><span className="eyebrow">BETTER TOGETHER</span><h1>Meet your next skill partner</h1>
      <p className="subtitle">Recommendations are people to explore. A match happens only after you both show interest.</p>
    </div>
    <div className="discovery-layout">
      <aside className="swap-intro card"><h2>A swap goes both ways</h2><p>Teach what you know.<br />Learn something new.<br />Grow together.</p>
        <div className="swap-skill blue"><span aria-hidden="true">✦</span><div>You teach<strong>Your saved public skills</strong></div></div>
        <div className="swap-arrows" aria-hidden="true">➜<br /><b>⟵</b></div>
        <div className="swap-skill green"><span aria-hidden="true">⌘</span><div>You learn<strong>Skills offered by partners</strong></div></div>
        <Link className="text-button" href="/onboarding">Edit your public profile and skills →</Link>
      </aside>
      <div className="profile-stack" aria-busy={loading}>
        <section className="card discovery-filters" aria-label="Discovery filters">
          <label>Skill to learn<select value={skillId} onChange={event => setSkillId(event.target.value)}><option value="">Any skill</option>{selections.filter(row => row.direction === "learn").map(row => <option value={row.skill_id} key={row.skill_id}>{catalog.find(item => item.id === row.skill_id)?.name ?? "Saved skill"}</option>)}</select></label>
          <label>Meeting preference<select value={mode} onChange={event => setMode(event.target.value as typeof mode)}><option value="">Any format</option><option value="online">Online</option><option value="in_person">In person</option></select></label>
          {(skillId || mode) && <button className="text-button" type="button" onClick={clearFilters}>Clear filters</button>}
        </section>
        {notice?.kind === "matched" && notice.matchId && <div className="card feedback" role="status"><strong>You matched with {notice.name}!</strong><p>Start a conversation to plan your skill exchange.</p><Link className="button" href={`/messages/${notice.matchId}`}>Send message</Link> <button className="button secondary" onClick={() => setNotice(null)}>Keep exploring</button></div>}
        {notice?.kind === "pending" && <p className="feedback" role="status">Interest sent. You’ll match if they’re interested too.</p>}
        {pending.length > 0 && <section className="card pending-interests" aria-label="Pending interests"><h2>Interest sent</h2><p className="muted">These people have not matched with you yet.</p><ul>{pending.map(item => <li key={item.partner.id}>{item.partner.display_name} <span className="badge blue">Waiting for their interest</span><button type="button" className="button secondary" disabled>Interest sent</button></li>)}</ul></section>}
        {loading && <p className="card empty" role="status">{result ? "Loading more partners…" : "Finding skill partners…"}</p>}
        {error && <div className="card empty"><p role="alert">{error}</p>{authPath ? <Link className="button" href={authPath}>{authPath === "/mfa" ? "Verify your second factor" : "Sign in again"}</Link> : <button className="button" onClick={() => reload(result?.meta.next_cursor || null)}>Try again</button>}</div>}
        {reason && <div className="card empty"><h2>{reason === "PROFILE_REQUIRED" ? "Introduce yourself to the community" : "Choose your skill exchange"}</h2><p>Add what you can teach and what you want to learn.</p><Link className="button lime" href="/onboarding">Set up your public profile →</Link></div>}
        {!loading && !error && result && !reason && !result.data.length && <div className="card empty"><h2>{skillId || mode ? "No partners found with these filters." : includeSkipped ? "You’ve reached the end of skipped profiles." : "No partners in this queue yet."}</h2>
          {(skillId || mode) && <button className="button secondary" onClick={clearFilters}>Clear filters</button>}
          {!includeSkipped && !skillId && !mode && <><p>Try another skill, or revisit profiles you skipped.</p><button className="button" onClick={() => setIncludeSkipped(true)}>Revisit skipped profiles</button></>}
          {includeSkipped && <button className="button secondary" onClick={() => setIncludeSkipped(false)}>Back to new recommendations</button>}
        </div>}
        {!!reciprocal.length && <section aria-labelledby="reciprocal-heading"><h2 id="reciprocal-heading" className="recommendation-heading">Reciprocal skill swaps</h2>{reciprocal.map(profile => <SkillCard key={profile.id} profile={profile} busy={Boolean(busyId)} onDecision={decision => void decide(profile.id, decision)} onBlock={id => setResult(current => current ? { ...current, data: current.data.filter(row => row.id !== id) } : current)} />)}</section>}
        {!!oneWay.length && <section aria-labelledby="one-way-heading"><h2 id="one-way-heading" className="recommendation-heading">Other potential partners</h2><p className="muted">These people have one relevant skill in common with your goals.</p>{oneWay.map(profile => <SkillCard key={profile.id} profile={profile} busy={Boolean(busyId)} onDecision={decision => void decide(profile.id, decision)} onBlock={id => setResult(current => current ? { ...current, data: current.data.filter(row => row.id !== id) } : current)} />)}</section>}
        {!loading && !error && !!result?.meta.next_cursor && <button className="button" onClick={() => reload(result.meta.next_cursor)}>Load more partners</button>}
        {!loading && !error && !!result?.data.length && !result.meta.next_cursor && <p className="muted">You’ve reached the end of these recommendations.</p>}
      </div>
    </div>
  </>;
}
