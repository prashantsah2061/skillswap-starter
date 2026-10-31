"use client";
import { useEffect, useState } from "react";
import { community, useDemo } from "./demo-provider";
import type { Member } from "@/lib/community/types";
import { Badge, Photo } from "./ui";
export function MemberProfile({ id }: { id: string }) {
  const { data, refresh } = useDemo();
  const [member, setMember] = useState<Member | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  useEffect(() => {
    let live = true;
    community<Member | null>({ op: "member", id })
      .then((r) => {
        if (live) setMember(r);
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [id]);
  async function decide(decision: string) {
    setBusy(true);
    try {
      const match = await community<string | null>(
        { op: "swipe", target: id, decision },
        true,
      );
      setNotice(
        match
          ? "You have a mutual match. Open Messages to connect."
          : decision === "like"
            ? "Interest saved. A match appears when both members like each other."
            : "Pass saved.",
      );
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {loading && <p>Loading member…</p>}
      {error && <p role="alert">{error}</p>}
      {member ? (
        <article className="card profile-preview">
          <Photo photo={member.avatar_url || ""} alt={member.display_name} />
          <h1>{member.display_name}</h1>
          {member.username && <p className="location">@{member.username}</p>}
          <p>{member.city}</p>
          <p>{member.bio}</p>
          {(["teach", "learn"] as const).map((d) => (
            <section key={d}>
              <h2>{d === "teach" ? "Teaches" : "Learning"}</h2>
              {member.user_skills
                ?.filter((s) => s.direction === d)
                .map((s) => (
                  <Badge key={s.skill_id}>
                    {data.skills.find((k) => k.id === s.skill_id)?.name} ·{" "}
                    {s.level}
                  </Badge>
                ))}
            </section>
          ))}
          {id !== data.userId && (
            <div className="decision-buttons">
              <button disabled={busy} onClick={() => decide("pass")}>
                Pass
              </button>
              <button disabled={busy} onClick={() => decide("like")}>
                Interested
              </button>
            </div>
          )}
          {notice && <p role="status">{notice}</p>}
        </article>
      ) : (
        !loading && !error && <p>This member is not available for discovery.</p>
      )}
    </>
  );
}
