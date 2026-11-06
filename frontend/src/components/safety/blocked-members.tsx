"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { blockUser, loadBlockedProfiles } from "@/lib/discovery/client";

type BlockedProfile = { user_id: string; display_name: string; created_at: string };
export function BlockedMembers() {
  const [profiles, setProfiles] = useState<BlockedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    loadBlockedProfiles(controller.signal).then(result => setProfiles(result.data))
      .catch(reason => setError(reason instanceof Error ? reason.message : "Blocked members could not be loaded."))
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  async function unblock(profile: BlockedProfile) {
    setBusy(profile.user_id); setError(""); setNotice("");
    try {
      await blockUser(profile.user_id, "unblock");
      setProfiles(current => current.filter(row => row.user_id !== profile.user_id));
      setNotice(`${profile.display_name} can appear in discovery again.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "This member could not be unblocked."); }
    finally { setBusy(null); }
  }

  return <>
    <p className="eyebrow">ACCOUNT SETTINGS</p><h1>Blocked members</h1>
    <p className="subtitle">Members you block are hidden from each other’s discovery, matches, messages, and sessions.</p>
    {error && <p className="error-feedback" role="alert">{error}</p>}{notice && <p className="feedback" role="status">{notice}</p>}
    {loading && <p className="card empty" role="status">Loading blocked members…</p>}
    {!loading && !profiles.length && !error && <div className="card empty"><h2>No blocked members</h2><p>People you block will be listed here.</p><Link href="/discover">Discover partners</Link></div>}
    <div className="blocked-members-list">{profiles.map(profile => <article className="card blocked-member" key={profile.user_id}>
      <div className="avatar" aria-hidden="true">{profile.display_name[0]}</div><div><h2>{profile.display_name}</h2><p className="muted">Blocked {new Date(profile.created_at).toLocaleDateString()}</p></div>
      <button className="button secondary" disabled={busy === profile.user_id} onClick={() => void unblock(profile)}>{busy === profile.user_id ? "Updating…" : "Unblock"}</button>
    </article>)}</div>
  </>;
}
