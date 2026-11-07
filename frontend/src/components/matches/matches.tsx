"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { loadMatches, type MatchSummary } from "@/lib/discovery/client";
import { SafetyActions } from "@/components/safety/safety-actions";

export function Matches() {
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    loadMatches(controller.signal).then(result => setMatches(result.data))
      .catch(reason => setError(reason instanceof Error ? reason.message : "Matches could not be loaded."))
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  return <>
    <div className="heading-row"><div><p className="eyebrow">YOUR LEARNING CIRCLE</p><h1>Your matches</h1><p className="subtitle">Good things start with a shared curiosity.</p></div><Link className="button lime" href="/discover">Find a partner →</Link></div>
    {loading && <p className="card empty" role="status">Loading your matches…</p>}
    {error && <div className="card empty"><p role="alert">{error}</p><button className="button" onClick={() => location.reload()}>Try again</button></div>}
    {!loading && !error && !matches.length && <div className="card empty"><h2>No matches yet</h2><p>Explore people and send interest to start matching. A confirmed match appears here after both people are interested.</p><Link className="button" href="/discover">Discover partners</Link></div>}
    {!!matches.length && <div className="matches-grid">{matches.map(match => <article key={match.id} className="card match-card"><div className="avatar" aria-hidden="true">{match.partner.display_name[0]}</div><div><span className="badge mint">Confirmed match</span><h2>{match.partner.display_name}</h2><p>{match.partner.bio || "Ready to exchange skills."}</p><p className="muted">Matched {new Date(match.created_at).toLocaleDateString()}</p><Link className="button full" href={`/messages/${match.id}`}>Send message →</Link><Link className="text-button" href="/sessions">Schedule a session →</Link><SafetyActions targetId={match.partner.id} matchId={match.id} onBlocked={() => location.reload()} /></div></article>)}</div>}
  </>;
}
