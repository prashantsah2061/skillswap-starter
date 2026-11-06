"use client";
import { useState, type FormEvent } from "react";
import { blockUser, reportUser } from "@/lib/discovery/client";

export function SafetyActions({ targetId, matchId, onBlocked }: { targetId: string; matchId?: string; onBlocked?: () => void }) {
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState<"spam" | "harassment" | "unsafe" | "impersonation" | "other">("other");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function block() {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try { await blockUser(targetId); setNotice("Member blocked. Their profile and conversation are now hidden."); onBlocked?.(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "This member could not be blocked."); }
    finally { setBusy(false); }
  }

  async function report(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try { await reportUser({ reported_id: targetId, ...(matchId ? { match_id: matchId } : {}), reason, details: details.trim() }); setReporting(false); setDetails(""); setNotice("Report sent to the moderation queue."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "This report could not be submitted."); }
    finally { setBusy(false); }
  }

  return <div className="safety-actions">
    <button type="button" className="text-button" disabled={busy} onClick={() => void block()}>Block member</button>
    <button type="button" className="text-button" disabled={busy} onClick={() => setReporting(value => !value)}>{reporting ? "Close report" : "Report member"}</button>
    {reporting && <form className="safety-report-form" onSubmit={report}>
      <label>Reason<select value={reason} onChange={event => setReason(event.target.value as typeof reason)}><option value="spam">Spam</option><option value="harassment">Harassment</option><option value="unsafe">Unsafe behavior</option><option value="impersonation">Impersonation</option><option value="other">Other</option></select></label>
      <label>Details (optional)<textarea rows={3} maxLength={2000} value={details} onChange={event => setDetails(event.target.value)} /></label>
      <button className="button" disabled={busy}>{busy ? "Sending…" : "Submit report"}</button>
    </form>}
    {error && <p className="error-feedback" role="alert">{error}</p>}{notice && <p className="feedback" role="status">{notice}</p>}
  </div>;
}
