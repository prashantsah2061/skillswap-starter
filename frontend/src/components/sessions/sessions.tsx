"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { changeSession, loadMatches, loadSessions, type MatchSummary, type SessionSummary } from "@/lib/discovery/client";

function localDateTime(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

export function Sessions({ selectedId }: { selectedId?: string }) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [matchId, setMatchId] = useState("");
  const [date, setDate] = useState("");
  const [duration, setDuration] = useState(60);
  const [notes, setNotes] = useState("");
  const [rescheduling, setRescheduling] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    const [matchResult, sessionResult] = await Promise.all([loadMatches(), loadSessions()]);
    setMatches(matchResult.data); setSessions(sessionResult.data);
    setMatchId(current => current || matchResult.data[0]?.id || "");
  }, []);

  useEffect(() => {
    let active = true;
    refresh().catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Sessions could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refresh]);

  async function submitProposal(event: FormEvent) {
    event.preventDefault();
    if (!matchId || !date || saving) return;
    setSaving(true); setError(""); setNotice("");
    try {
      await changeSession({ action: "propose", match_id: matchId, scheduled_at: new Date(date).toISOString(), duration_minutes: duration, notes: notes.trim() });
      setDate(""); setNotes(""); await refresh(); setNotice("Session proposal sent.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "The session could not be proposed."); }
    finally { setSaving(false); }
  }

  async function act(input: Record<string, unknown>, success: string) {
    if (saving) return;
    setSaving(true); setError(""); setNotice("");
    try { await changeSession(input); await refresh(); setRescheduling(null); setNotice(success); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "The session could not be updated."); }
    finally { setSaving(false); }
  }

  function controls(session: SessionSummary) {
    const status = session.status;
    return <div className="session-actions">
      {(status === "proposed" || status === "reschedule_requested") && session.can_accept && <button className="button" disabled={saving} onClick={() => void act({ action: "accept", session_id: session.id }, status === "proposed" ? "Session confirmed." : "New time confirmed.")}>{status === "proposed" ? "Accept proposal" : "Accept new time"}</button>}
      {status === "confirmed" && <button className="button secondary" disabled={saving} onClick={() => { setRescheduling(session.id); setRescheduleDate(localDateTime(session.scheduled_at)); }}>Propose a new time</button>}
      {status === "confirmed" && new Date(session.scheduled_at).getTime() <= Date.now() && <button className="button" disabled={saving} onClick={() => void act({ action: "complete", session_id: session.id }, "Session marked complete.")}>Mark complete</button>}
      {["proposed", "confirmed", "reschedule_requested"].includes(status) && <button className="text-button" disabled={saving} onClick={() => void act({ action: "cancel", session_id: session.id }, "Session cancelled.")}>Cancel session</button>}
      {rescheduling === session.id && <form className="session-reschedule" onSubmit={event => { event.preventDefault(); void act({ action: "reschedule", session_id: session.id, scheduled_at: new Date(rescheduleDate).toISOString() }, "New time proposed."); }}>
        <label>New proposed time<input type="datetime-local" required value={rescheduleDate} onChange={event => setRescheduleDate(event.target.value)} /></label>
        <button className="button" disabled={saving || !rescheduleDate}>Send new time</button><button type="button" className="text-button" onClick={() => setRescheduling(null)}>Keep current time</button>
      </form>}
    </div>;
  }

  return <>
    <div className="heading-row"><div><p className="eyebrow">MAKE TIME TO LEARN</p><h1>Skill sessions</h1><p className="subtitle">Propose a time, confirm it together, then mark the exchange complete.</p></div><Link className="button secondary" href="/matches">View matches →</Link></div>
    <form className="card profile-form session-proposal" onSubmit={submitProposal}>
      <h2>Propose a session</h2>
      {!matches.length && !loading ? <p className="muted">You need a match before you can schedule a session. <Link href="/discover">Find a partner</Link></p> : <>
        <label>Partner<select required value={matchId} onChange={event => setMatchId(event.target.value)}><option value="">Choose a match</option>{matches.map(match => <option value={match.id} key={match.id}>{match.partner.display_name}</option>)}</select></label>
        <label>Proposed date and time<input type="datetime-local" required value={date} onChange={event => setDate(event.target.value)} /></label>
        <label>Duration<select value={duration} onChange={event => setDuration(Number(event.target.value))}><option value={30}>30 minutes</option><option value={60}>1 hour</option><option value={90}>1.5 hours</option><option value={120}>2 hours</option></select></label>
        <label>What would you like to work on?<textarea rows={2} maxLength={1000} value={notes} onChange={event => setNotes(event.target.value)} /></label>
        <button className="button lime" disabled={saving || !matchId || !date}>{saving ? "Sending…" : "Send session proposal"}</button>
      </>}
    </form>
    {error && <p className="error-feedback" role="alert">{error}</p>}{notice && <p className="feedback" role="status">{notice}</p>}
    {loading && <p className="card empty" role="status">Loading sessions…</p>}
    {!loading && !error && !sessions.length && <div className="card empty"><h2>No sessions scheduled</h2><p>Once you’re matched, suggest a time to start learning together.</p></div>}
    <div className="sessions-list">{sessions.map(session => <article className="card session-card" key={session.id}>
      <div className="session-card-heading"><div><p className="eyebrow">WITH {session.partner.display_name.toUpperCase()}</p><h2>{new Date(session.scheduled_at).toLocaleString()}</h2></div><span className={`badge ${session.status === "confirmed" ? "mint" : session.status === "cancelled" ? "" : "blue"}`}>{session.status.replaceAll("_", " ")}</span></div>
      <p>{session.duration_minutes} minutes · Proposed by {session.mine ? "you" : session.partner.display_name}</p>
      {session.status === "reschedule_requested" && session.proposed_at && <p className="feedback">New time proposed: {new Date(session.proposed_at).toLocaleString()}{session.can_accept ? " · Please accept or cancel." : " · Waiting for your partner."}</p>}
      {session.notes && <p>{session.notes}</p>}
      {controls(session)}
      <Link className="text-button" href={`/sessions/${session.id}`}>Session details →</Link>
    </article>)}</div>
    {selectedId && !loading && !sessions.some(session => session.id === selectedId) && <div className="card empty"><h2>Session unavailable</h2><Link className="button" href="/sessions">View your sessions</Link></div>}
  </>;
}
