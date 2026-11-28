"use client";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { DemoProfile } from "@/lib/frontend-data";
import Link from "next/link";
import { useDemo } from "./demo-provider";
import { useAccount } from "@/components/auth/account-provider";
import { saveProfileAction, uploadProfileAvatarAction } from "@/lib/profile/actions";
import { Badge } from "./ui";
import { Camera, UserRound } from "lucide-react";

const maxAvatarBytes = 900 * 1024;
const targetAvatarBytes = 800 * 1024;

async function prepareAvatarUpload(file: File): Promise<File> {
  if (file.size <= maxAvatarBytes) return file;
  if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(file.type)) {
    throw new Error("Choose a JPG, PNG, or WebP image under 900 KB.");
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    let best: Blob | null = null;

    for (const maxDimension of [1600, 1200, 960, 720]) {
      const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("This photo could not be prepared. Try another image.");
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      for (const quality of [0.84, 0.74, 0.64]) {
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
        if (blob && (!best || blob.size < best.size)) best = blob;
        if (blob && blob.size <= targetAvatarBytes) {
          const basename = file.name.replace(/\.[^.]+$/, "") || "profile";
          return new File([blob], `${basename}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
        }
      }
    }

    if (best && best.size <= maxAvatarBytes) {
      const basename = file.name.replace(/\.[^.]+$/, "") || "profile";
      return new File([best], `${basename}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
    }
    throw new Error("This photo is too large to upload. Choose a smaller image.");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function Profile() {
  const account = useAccount();
  const [saving, setSaving] = useState(false);
  const { data, update, storageWarning } = useDemo();
  const [draft, setDraft] = useState<DemoProfile | null>(null);
  const [notice, setNotice] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
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
  async function uploadPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    setNotice("");
    try {
      const formData = new FormData();
      formData.set("avatar", await prepareAvatarUpload(file));
      const result = await uploadProfileAvatarAction(formData);
      if (result.error || !result.avatarUrl || !account.profile) {
        setNotice(result.error || "Photo could not be saved. Please try again.");
        return;
      }
      account.setProfile({ ...account.profile, avatar_url: result.avatarUrl });
      setNotice("Profile picture updated.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Photo could not be uploaded. Please try again.");
    } finally {
      setUploadingPhoto(false);
      e.target.value = "";
    }
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
          {account.profile?.avatar_url ? (
            <img className="profile-avatar" src={account.profile.avatar_url} alt={`${profile.name}'s profile`} />
          ) : (
            <div className="profile-avatar profile-avatar-empty" aria-label="No profile picture selected">
              <UserRound size={54} strokeWidth={1.25} aria-hidden="true" />
            </div>
          )}
          <input
            ref={photoInput}
            className="profile-photo-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={uploadPhoto}
            aria-label="Choose a profile picture"
          />
          <button type="button" className="profile-photo-button" disabled={uploadingPhoto || !account.profile} onClick={() => photoInput.current?.click()}>
            <Camera size={16} aria-hidden="true" />
            {uploadingPhoto ? "Uploading…" : account.profile?.avatar_url ? "Change profile picture" : "Add profile picture"}
          </button>
          <Badge tone="mint">Your profile</Badge>
          <h2>{profile.name}</h2>
          <p className="muted">⌖ {profile.city}</p>
          <p>{profile.bio}</p>
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
          <p>Your account name, city, and bio stay private. Your discovery profile and skills are managed separately.</p>
          <Link className="text-button" href="/onboarding">Edit your public profile and skill selections →</Link>
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
              ? "Browser storage is unavailable. Demo preferences last for this visit."
              : "Your profile picture, name, city, and bio are saved to your account."}
          </small>
        </section>
      </form>
    </>
  );
}
