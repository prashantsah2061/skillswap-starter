"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Badge } from "@/components/demo/ui";
import { loadPublicOnboarding, savePublicOnboarding, PublicApiError, type PublicSkill, type PublicSelection } from "@/lib/discovery/client";

export function PublicOnboarding() {
  const [catalog, setCatalog] = useState<PublicSkill[]>([]);
  const [selections, setSelections] = useState<PublicSelection[]>([]);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [authPath, setAuthPath] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    loadPublicOnboarding(controller.signal).then(value => {
      if (controller.signal.aborted) return;
      setCatalog(value.catalog); setSelections(value.selections);
      setName(value.profile?.display_name || ""); setBio(value.profile?.bio || "");
      setReady(true); setError(""); setAuthPath(null);
    }).catch(reason => {
      if (controller.signal.aborted) return;
      setError(reason instanceof Error ? reason.message : "Your public profile could not be loaded.");
      if (reason instanceof PublicApiError) setAuthPath(reason.status === 401 ? "/login" : reason.code === "MFA_REQUIRED" ? "/mfa" : null);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving || !ready) return;
    setSaved(false); setError("");
    if (!["teach", "learn"].every(direction => selections.some(row => row.direction === direction))) {
      setError("Choose at least one skill to teach and one to learn."); return;
    }
    setSaving(true);
    try { await savePublicOnboarding({ display_name: name.trim(), bio: bio.trim() }, selections); setSaved(true); }
    catch (reason) {
      const message = reason instanceof Error ? reason.message : "The save could not be completed.";
      setError(`${message} Some changes may already be saved. Retry to finish, or reload to review saved choices.`);
      if (reason instanceof PublicApiError) setAuthPath(reason.status === 401 ? "/login" : reason.code === "MFA_REQUIRED" ? "/mfa" : null);
    } finally { setSaving(false); }
  }
  function retry() { setLoading(true); setReady(false); setSaved(false); setReload(value => value + 1); }
  return <>
    <p className="eyebrow">A SWAP GOES BOTH WAYS</p>
    <h1>Your public skill profile</h1>
    <p className="subtitle">Choose what other signed-in members can see and what you’d like to exchange.</p>
    {loading ? <p className="card empty" role="status">Loading your saved public profile…</p> : <form className="profile-layout" onSubmit={save}>
      <aside className="card profile-preview">
        <Badge tone="mint">Visible to members</Badge>
        <h2>{name || "Your public name"}</h2><p>{bio || "Write a public introduction."}</p>
        <p>Your private account profile stays separate. Nothing is copied or published automatically.</p>
        <Link className="text-button" href="/profile">Back to account profile →</Link>
      </aside>
      <section className="card profile-form">
        <h2>Teach what you know. Learn something new.</h2>
        <fieldset disabled={!ready || saving}>
          <label>Public display name<input required minLength={2} maxLength={80} value={name} onChange={event => { setName(event.target.value); setSaved(false); }} /></label>
          <label>Public bio (optional)<textarea rows={3} maxLength={500} value={bio} onChange={event => { setBio(event.target.value); setSaved(false); }} /></label>
          {(["teach", "learn"] as const).map(direction => <fieldset key={direction}>
            <legend>{direction === "teach" ? "Skills you can teach" : "Skills you want to learn"}</legend>
            <div className="editable-skills">{selections.filter(row => row.direction === direction).map(row => <span className={`badge ${direction === "teach" ? "blue" : "mint"}`} key={row.skill_id}>
              {catalog.find(skill => skill.id === row.skill_id)?.name || "Unavailable catalog skill"}
              <button type="button" aria-label={`Remove ${catalog.find(skill => skill.id === row.skill_id)?.name || "skill"} from ${direction}`} onClick={() => { setSelections(value => value.filter(item => item !== row)); setSaved(false); }}>×</button>
            </span>)}</div>
            <select aria-label={`Add a skill to ${direction}`} value="" onChange={event => { const skill_id = event.target.value; if (skill_id) { setSelections(value => [...value, { skill_id, direction }]); setSaved(false); } }}>
              <option value="">+ Add a skill</option>
              {catalog.filter(skill => !selections.some(row => row.skill_id === skill.id && row.direction === direction)).map(skill => <option value={skill.id} key={skill.id}>{skill.name}</option>)}
            </select>
          </fieldset>)}
          {!catalog.length && ready && <p className="feedback">The skill catalog is empty. Ask the team to configure the development catalog before continuing.</p>}
          <p className="muted">Saving publishes this name, bio, and selected skills to signed-in members.</p>
          <button className="button lime" disabled={!catalog.length}>{saving ? "Saving…" : "Save public profile and skills"}</button>
        </fieldset>
        {error && <p className="error-feedback" role="alert">{error}</p>}
        {authPath && <Link className="button" href={authPath}>{authPath === "/mfa" ? "Verify your second factor" : "Sign in again"}</Link>}
        {!saving && <button type="button" className="text-button" onClick={retry}>Reload saved choices</button>}
        {saved && <p className="feedback" role="status">Public profile and skills saved. <Link href="/discover">Discover partners →</Link></p>}
      </section>
    </form>}
  </>;
}
