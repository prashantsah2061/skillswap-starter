"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { DiscoverResponse } from "@shared/discovery";
import { loadDiscovery, PublicApiError } from "@/lib/discovery/client";
import { SkillCard } from "./skill-card";

export function Discovery() {
  const [result, setResult] = useState<DiscoverResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authPath, setAuthPath] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  function fetchPage(controller: AbortController, cursor: string | null) {
    return loadDiscovery(cursor, controller.signal).then(page => {
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
  function load(cursor: string | null = null) {
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    setLoading(true); setError(""); setAuthPath(null);
    void fetchPage(controller, cursor);
  }
  useEffect(() => {
    const controller = new AbortController(); active.current = controller;
    void fetchPage(controller, null);
    return () => active.current?.abort();
  }, []);
  const reason = result?.meta.reason;
  return <>
    <div className="discovery-heading"><span className="eyebrow">BETTER TOGETHER</span><h1>Meet your next skill partner</h1>
      <p className="subtitle">Find people who can teach what you want to learn—and want to learn what you offer.</p>
    </div>
    <div className="discovery-layout">
      <aside className="swap-intro card"><h2>A swap goes both ways</h2><p>Teach what you know.<br />Learn what you’re curious about.<br />Grow a little, together.</p>
        <div className="swap-skill blue"><span>✦</span><div>You teach<strong>Your saved public skills</strong></div></div>
        <div className="swap-arrows">➜<br /><b>⟵</b></div>
        <div className="swap-skill green"><span>⌘</span><div>You learn<strong>Skills offered by your partners</strong></div></div>
        <Link className="text-button" href="/onboarding">Edit your public profile and skills →</Link>
      </aside>
      <div className="profile-stack" aria-busy={loading}>
        {result?.meta.matching?.fallback_reason && <p className="feedback" role="status">Using exact skill matching. Related-skill matching is unavailable for this search.</p>}
        {result?.meta.matching?.mode === "semantic" && <p className="muted">Related-skill suggestions use cosine similarity scores, not probabilities. Confirm the learning fit with your partner.</p>}
        {loading && <p className="card empty" role="status">{result ? "Loading more partners…" : "Finding skill partners…"}</p>}
        {error && <div className="card empty"><p role="alert">{error}</p>{authPath ? <Link className="button" href={authPath}>{authPath === "/mfa" ? "Verify your second factor" : "Sign in again"}</Link> : <button className="button" onClick={() => void load(result?.meta.next_cursor || null)}>Try again</button>}</div>}
        {reason && <div className="card empty"><h2>{reason === "PROFILE_REQUIRED" ? "Introduce yourself to the community" : "Choose your skill exchange"}</h2><p>Save a public profile with at least one skill to teach and one to learn.</p><Link className="button lime" href="/onboarding">Set up your public profile →</Link></div>}
        {!loading && !error && result && !reason && !result.data.length && <div className="card empty"><h2>No reciprocal partners yet</h2><p>Try adding another skill to teach or learn, or check back as more members join.</p><Link className="button" href="/onboarding">Review your skills</Link></div>}
        {result?.data.map(profile => <SkillCard key={profile.id} profile={profile} />)}
        {!loading && !error && result?.meta.next_cursor && <button className="button" onClick={() => void load(result.meta.next_cursor)}>Load more partners</button>}
        {!loading && !error && !!result?.data.length && !result.meta.next_cursor && <p className="muted">You’ve reached the end of your current recommendations.</p>}
      </div>
    </div>
  </>;
}
