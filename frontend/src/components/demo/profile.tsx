"use client";
import { useState, type FormEvent } from "react";
import { useDemo, community } from "./demo-provider";
import { useAccount } from "@/components/auth/account-provider";
import type { Selection } from "@/lib/community/types";
import { Photo, Badge } from "./ui";
export function Profile() {
  const { data, refresh } = useDemo(),
    account = useAccount();
  const [name, setName] = useState(data.profile.display_name),
    [city, setCity] = useState(data.profile.city),
    [bio, setBio] = useState(data.profile.bio),
    [visible, setVisible] = useState(data.profile.visible),
    [selections, setSelections] = useState<Selection[]>(data.selections),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setNotice("");
    try {
      await community(
        { op: "profile", name, city, bio, visible, selections },
        true,
      );
      await refresh();
      account.setProfile({
        user_id: data.userId,
        display_name: name.trim(),
        city: city.trim(),
        bio: bio.trim(),
      });
      setName(name.trim());
      setCity(city.trim());
      setBio(bio.trim());
      setNotice("Profile and skills saved.");
    } catch (e) {
      setNotice((e as Error).message);
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
      <form className="profile-layout" onSubmit={save}>
        <aside className="card profile-preview">
          <Photo photo="" alt={name} />
          <Badge tone="mint">Your profile</Badge>
          <h2>{name}</h2>
          <p>{city}</p>
          <p>{bio}</p>
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
              City
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
              setVisible(data.profile.visible);
              setSelections(data.selections);
              setNotice("Changes discarded.");
            }}
          >
            Cancel edits
          </button>
          {notice && <p role="status">{notice}</p>}
        </section>
      </form>
    </>
  );
}
