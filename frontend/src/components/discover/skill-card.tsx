import type { DiscoveryCandidate } from "@shared/discovery";
import { Badge } from "@/components/demo/ui";
import { SafetyActions } from "@/components/safety/safety-actions";

export function SkillCard({ profile, busy = false, onDecision, onBlock }: {
  profile: DiscoveryCandidate;
  busy?: boolean;
  onDecision?: (decision: "like" | "pass") => void;
  onBlock?: (profileId: string) => void;
}) {
  return <article className="partner-card card">
    <div className="partner-body">
      <div className="avatar" aria-hidden="true">{profile.display_name.trim().charAt(0).toUpperCase()}</div>
      <h2>{profile.display_name}</h2>
      {profile.bio && <p className="partner-bio">{profile.bio.length > 160 ? `${profile.bio.slice(0, 157)}…` : profile.bio}</p>}
      <div className="partner-skills">
        {profile.compatibility.you_can_learn.length > 0 && <div><strong>{profile.recommendation_type === "reciprocal" ? "Can teach you" : "Teaches"}</strong><div>{profile.compatibility.you_can_learn.map(skill => <Badge key={skill.id}>{skill.name}</Badge>)}</div></div>}
        {profile.compatibility.you_can_teach.length > 0 && <div><strong>{profile.recommendation_type === "reciprocal" ? "Wants to learn from you" : "Wants to learn"}</strong><div>{profile.compatibility.you_can_teach.map(skill => <Badge tone="mint" key={skill.id}>{skill.name}</Badge>)}</div></div>}
      </div>
      <div className="partner-context">
        {profile.meeting_preference && <span>{profile.meeting_preference === "online" ? "Online" : profile.meeting_preference === "in_person" ? "In person" : "Online or in person"}</span>}
        {!profile.meeting_preference && <span>Meeting preference not provided</span>}
      </div>
      {profile.recommendation_reason && <p className="recommendation-reason">{profile.recommendation_reason}</p>}
      <details className="profile-details"><summary>View profile</summary><div><p>{profile.bio || "No bio provided."}</p><p><strong>Skills they teach:</strong> {profile.teaches.map(skill => skill.name).join(", ") || "Not provided"}</p><p><strong>Skills they want to learn:</strong> {profile.learns.map(skill => skill.name).join(", ") || "Not provided"}</p></div></details>
      {onDecision && <div className="decision-buttons">
        <button type="button" onClick={() => onDecision("pass")} disabled={busy}>Skip</button>
        <button type="button" onClick={() => onDecision("like")} disabled={busy}>Interested</button>
      </div>}
      <SafetyActions targetId={profile.id} onBlocked={() => onBlock?.(profile.id)} />
    </div>
  </article>;
}
