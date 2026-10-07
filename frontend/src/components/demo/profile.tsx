"use client";
import { useState, type FormEvent } from "react";
import { categories, type DemoProfile } from "@/lib/frontend-data";
import { useDemo } from "./demo-provider";
import { Photo, Badge } from "./ui";
export function Profile() {
  const { data, update, storageWarning } = useDemo();
  const [draft, setDraft] = useState<DemoProfile | null>(null);
  const [notice, setNotice] = useState("");
  const profile = draft || data.profile;
  function edit<K extends keyof DemoProfile>(key: K, value: DemoProfile[K]) {
    setDraft({ ...profile, [key]: value });
    setNotice("");
  }
  function save(e: FormEvent) {
    e.preventDefault();
    if (
      !profile.name.trim() ||
      !profile.city.trim() ||
      !profile.teaches.length ||
      !profile.learns.length
    ) {
      setNotice(
        "Add your name, city, and at least one teaching and learning skill.",
      );
      return;
    }
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
      "Demo profile saved locally. Your changes appear across SkillSwap.",
    );
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
          <Badge tone="mint">Demo profile</Badge>
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
          <div className="form-grid">
            <label>
              Name
              <input
                required
                maxLength={60}
                value={profile.name}
                onChange={(e) => edit("name", e.target.value)}
              />
            </label>
            <label>
              City
              <input
                required
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
            <button className="button lime">Save demo profile</button>
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
              ? "Browser storage is unavailable. Changes last for this visit."
              : "Non-sensitive demo preferences stay in this browser."}
          </small>
        </section>
      </form>
    </>
  );
}
