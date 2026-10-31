"use client";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useDemo, community } from "./demo-provider";
import { useAccount } from "@/components/auth/account-provider";
import type { Selection } from "@/lib/community/types";
import { Photo, Badge } from "./ui";
const MAX_PICTURE = 5 * 1024 * 1024;
async function sendPicture(file: File | null) {
  const form = new FormData();
  if (file) form.append("file", file);
  const response = await fetch("/api/avatar", {
    method: file ? "POST" : "DELETE",
    body: file ? form : undefined,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Picture could not be saved.");
  return result.avatar_url as string | null;
}
export function Profile() {
  const { data, refresh } = useDemo(),
    account = useAccount();
  const [name, setName] = useState(data.profile.display_name),
    [city, setCity] = useState(data.profile.city),
    [bio, setBio] = useState(data.profile.bio),
    [username, setUsername] = useState(data.profile.username || ""),
    // Finishing setup opts in to Discover; the checkbox can still opt out.
    [visible, setVisible] = useState(
      data.profile.onboarded ? data.profile.visible : true,
    ),
    [picture, setPicture] = useState(data.profile.avatar_url || ""),
    // undefined: unchanged. null: remove. File: upload on save.
    [pendingPicture, setPendingPicture] = useState<File | null | undefined>(),
    [selections, setSelections] = useState<Selection[]>(data.selections),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const preview = useRef("");
  const clearPreview = () => {
    if (preview.current) URL.revokeObjectURL(preview.current);
    preview.current = "";
  };
  useEffect(() => clearPreview, []);
  const missing = [
    !bio.trim() && "a bio",
    !selections.some((s) => s.direction === "teach") && "a skill to teach",
    !selections.some((s) => s.direction === "learn") && "a skill to learn",
  ].filter(Boolean);
  function choosePicture(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    // The server checks the file's real content; this is only quick feedback.
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
      return setNotice({ text: "Use a JPEG, PNG, or WebP picture.", error: true });
    if (file.size > MAX_PICTURE)
      return setNotice({ text: "Choose a picture under 5 MB.", error: true });
    clearPreview();
    preview.current = URL.createObjectURL(file);
    setPicture(preview.current);
    setPendingPicture(file);
    setNotice({ text: "Preview only. Save your profile to keep this picture." });
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      await community(
        { op: "profile", name, username, city, bio, visible, selections },
        true,
      );
      let avatar = data.profile.avatar_url || null;
      let pictureError = "";
      if (pendingPicture !== undefined) {
        try {
          avatar = await sendPicture(pendingPicture);
          clearPreview();
          setPicture(avatar || "");
          setPendingPicture(undefined);
        } catch (e) {
          pictureError = (e as Error).message;
        }
      }
      await refresh();
      account.setProfile({
        user_id: data.userId,
        display_name: name.trim(),
        city: city.trim(),
        bio: bio.trim(),
        avatar_url: avatar,
      });
      setName(name.trim());
      setCity(city.trim());
      setBio(bio.trim());
      setUsername(username.trim().toLowerCase());
      setNotice(
        pictureError
          ? { text: `Profile saved, but your picture was not. ${pictureError}`, error: true }
          : missing.length
            ? { text: `Saved. Add ${missing.join(", ")} to appear in Discover.` }
            : { text: "Profile saved." },
      );
    } catch (e) {
      setNotice({ text: (e as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <p className="eyebrow">A LITTLE ABOUT YOU</p>
      <h1>Your profile</h1>
      <p className="subtitle">
        Your experience is someone else’s next adventure.
      </p>
      {!data.profile.onboarded && (
        <p className="feedback" role="status">
          Welcome! Finish your profile to appear in Discover and start matching.
        </p>
      )}
      <form className="profile-layout" onSubmit={save}>
        <aside className="card profile-preview">
          <Photo photo={picture} alt={name} />
          <div className="picture-actions">
            <label className="text-button">
              {picture ? "Change picture" : "Upload picture"}
              <input
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={choosePicture}
              />
            </label>
            {picture && (
              <button
                type="button"
                className="text-button"
                disabled={busy}
                onClick={() => {
                  clearPreview();
                  setPicture("");
                  setPendingPicture(null);
                  setNotice({ text: "Save your profile to remove your picture." });
                }}
              >
                Remove picture
              </button>
            )}
          </div>
          <Badge tone="mint">Your profile</Badge>
          <h2>{name}</h2>
          {username && <p className="location">@{username.trim().toLowerCase()}</p>}
          <p>{city}</p>
          <p>{bio}</p>
          {data.profile.created_at && (
            <small>
              Member since {new Date(data.profile.created_at).toLocaleDateString()}
            </small>
          )}
        </aside>
        <section className="card profile-form">
          <h2>Make yourself known</h2>
          <div className="form-grid">
            <label>
              Display name
              <input
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Username
              <input
                maxLength={30}
                pattern="[A-Za-z0-9_]{3,30}"
                title="3–30 letters, numbers, or underscores"
                autoComplete="off"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </label>
            <label>
              Email
              <input value={data.email} readOnly disabled />
            </label>
            <label>
              Location (optional)
              <input
                maxLength={80}
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </label>
          </div>
          <label>
            Bio
            <textarea
              maxLength={500}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={visible}
              onChange={(e) => setVisible(e.target.checked)}
            />{" "}
            Show my profile in discovery (existing matches can still view it)
          </label>
          {(["teach", "learn"] as const).map((direction) => (
            <fieldset key={direction}>
              <legend>
                {direction === "teach"
                  ? "Skills you can teach"
                  : "Skills you want to learn"}
              </legend>
              {selections
                .filter((s) => s.direction === direction)
                .map((s) => (
                  <div className="editable-skills" key={s.skill_id}>
                    <Badge>
                      {data.skills.find((k) => k.id === s.skill_id)?.name}
                    </Badge>
                    <select
                      aria-label="Proficiency"
                      value={s.level}
                      onChange={(e) =>
                        setSelections((old) =>
                          old.map((x) =>
                            x === s
                              ? {
                                  ...x,
                                  level: e.target.value as Selection["level"],
                                }
                              : x,
                          ),
                        )
                      }
                    >
                      {["beginner", "intermediate", "advanced"].map((l) => (
                        <option key={l}>{l}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        setSelections((old) => old.filter((x) => x !== s))
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
              <select
                value=""
                aria-label={`Add ${direction} skill`}
                onChange={(e) => {
                  if (e.target.value)
                    setSelections((old) => [
                      ...old,
                      {
                        skill_id: e.target.value,
                        direction,
                        level: "beginner",
                      },
                    ]);
                }}
              >
                <option value="">+ Add a skill</option>
                {data.skills
                  .filter(
                    (k) =>
                      !selections.some(
                        (s) => s.skill_id === k.id && s.direction === direction,
                      ),
                  )
                  .map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name}
                    </option>
                  ))}
              </select>
            </fieldset>
          ))}
          {!data.skills.length && (
            <p>
              No skills are available yet. Please check back soon or contact
              support.
            </p>
          )}
          <button className="button lime" disabled={busy}>
            {busy
              ? "Saving…"
              : data.profile.onboarded
                ? "Save profile"
                : "Save profile & complete onboarding"}
          </button>
          <button
            type="button"
            className="text-button"
            disabled={busy}
            onClick={() => {
              setName(data.profile.display_name);
              setCity(data.profile.city);
              setBio(data.profile.bio);
              setUsername(data.profile.username || "");
              setVisible(data.profile.onboarded ? data.profile.visible : true);
              setSelections(data.selections);
              clearPreview();
              setPicture(data.profile.avatar_url || "");
              setPendingPicture(undefined);
              setNotice({ text: "Changes discarded." });
            }}
          >
            Cancel edits
          </button>
          {notice && (
            <p
              className={notice.error ? "error-feedback" : "feedback"}
              role={notice.error ? "alert" : "status"}
            >
              {notice.text}
            </p>
          )}
        </section>
      </form>
    </>
  );
}
