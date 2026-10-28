"use client";
import { useState, type FormEvent } from "react";
import { categories, type DemoProfile } from "@/lib/frontend-data";
import { useDemo } from "./demo-provider";
import { useAccount } from "@/components/auth/account-provider";
import { saveProfileAction } from "@/lib/profile/actions";
import { Photo, Badge } from "./ui";
export function Profile() {
  const account = useAccount();
  const [saving, setSaving] = useState(false);
  const { data, update, storageWarning } = useDemo();
  const [draft, setDraft] = useState<DemoProfile | null>(null);
  const [notice, setNotice] = useState("");
  const profile = draft || { ...data.profile, name: account.name, city: account.profile?.city || "", bio: account.profile?.bio || "" };
  function edit<K extends keyof DemoProfile>(key: K, value: DemoProfile[K]) {
    setDraft({ ...profile, [key]: value });
    setNotice("");
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!profile.name.trim()) { setNotice("Enter your display name."); return; }
    setSaving(true);
    try {
      const result = await saveProfileAction({ display_name: profile.name, city: profile.city, bio: profile.bio });
      if (result.error || !result.profile) { setNotice(result.error || "Profile could not be saved."); return; }
      account.setProfile(result.profile);
    update((d) => ({
      ...d,
      profile: {
        ...profile,
        name: profile.name.trim(),
        city: profile.city.trim(),
        bio: profile.bio.trim(),
      },
    }));
    setDraft(null);
    setNotice(
      "Profile saved. Your display name is updated across SkillSwap.",
    );
    } catch { setNotice("Profile could not be saved. Please try again."); }
    finally { setSaving(false); }
  }
  return (
    <>
      <p className="eyebrow">A LITTLE ABOUT YOU</p>
      <h1>Your profile</h1>
      <p className="subtitle">
        Your experience is someone else’s next adventure.
      </p>
      <form className="profile-layout" onSubmit={save}>
        <aside className="card profile-preview">
          <Photo photo={profile.photo} alt="Demo profile photo" />
          <Badge tone="mint">Your profile</Badge>
          <h2>{profile.name}</h2>
          <p className="muted">⌖ {profile.city}</p>
          <p>{profile.bio}</p>
          <label>
            Choose a placeholder photo
            <select
              value={profile.photo}
              onChange={(e) => edit("photo", e.target.value)}
            >
              <option value="alex">Alex</option>
              <option value="maya">Maya</option>
              <option value="jordan">Jordan</option>
            </select>
          </label>
          <small className="muted">
            Reference-based placeholder portraits for this demo.
          </small>
        </aside>
        <section className="card profile-form">
          <h2>Make yourself known</h2>
          {!account.profile && <p className="error-feedback">Your profile is temporarily unavailable. Please try again later.</p>}
          <div className="form-grid">
            <label>
              Display name
              <input
                required
                maxLength={80}
                value={profile.name}
                onChange={(e) => edit("name", e.target.value)}
              />
            </label>
            <label>
              City (optional)
              <input
                maxLength={80}
                value={profile.city}
                onChange={(e) => edit("city", e.target.value)}
              />
            </label>
          </div>
          <label>
            Bio
            <textarea
              maxLength={500}
              rows={3}
              value={profile.bio}
              onChange={(e) => edit("bio", e.target.value)}
            />
          </label>
          {(["teaches", "learns"] as const).map((key) => (
            <fieldset key={key}>
              <legend>
                {key === "teaches"
                  ? "Skills you can teach"
                  : "Skills you want to learn"}
              </legend>
              <div className="editable-skills">
                {profile[key].map((s) => (
                  <span
                    className={`badge ${key === "teaches" ? "blue" : "mint"}`}
                    key={s}
                  >
                    {s}
                    <button
                      type="button"
                      aria-label={`Remove ${s} from ${key}`}
                      onClick={() =>
                        edit(
                          key,
                          profile[key].filter((x) => x !== s),
                        )
                      }
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <select
                aria-label={`Add a skill to ${key}`}
                value=""
                onChange={(e) => {
                  if (e.target.value)
                    edit(key, [...profile[key], e.target.value]);
                }}
              >
                <option value="">+ Add a skill</option>
                {categories
                  .flatMap((c) => c.skills)
                  .filter((s) => !profile[key].includes(s))
                  .map((s) => (
                    <option key={s}>{s}</option>
                  ))}
              </select>
            </fieldset>
          ))}
          <div className="profile-save">
            <button className="button lime" disabled={saving || !account.profile}>{saving ? "Saving…" : "Save profile"}</button>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setDraft(null);
                setNotice("Changes discarded.");
              }}
            >
              Cancel edits
            </button>
          </div>
          {notice && (
            <p className="feedback" role="status">
              {notice}
            </p>
          )}
          <small className="muted">
            {storageWarning
              ? "Browser storage is unavailable. Skill and photo preferences last for this visit."
              : "Your name, city, and bio are saved to your account. Skill and photo preferences stay in this browser."}
          </small>
        </section>
      </form>
    </>
  );
}
