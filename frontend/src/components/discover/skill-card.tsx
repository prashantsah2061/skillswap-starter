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
      <div className="avatar" aria-hidden="true">{profile.display_name[0]}</div>
      <h2>{profile.display_name}</h2><p>{profile.bio}</p>
      <div className="partner-skills">
        <div><strong>{profile.semantic ? "Potential learning fit" : "Can teach you"}</strong><div>{profile.compatibility.you_can_learn.map(skill => <Badge key={skill.id}>{skill.name}</Badge>)}</div></div>
        <div><strong>{profile.semantic ? "Potential teaching fit" : "Wants to learn from you"}</strong><div>{profile.compatibility.you_can_teach.map(skill => <Badge tone="mint" key={skill.id}>{skill.name}</Badge>)}</div></div>
      </div>
      {profile.semantic && <div className="muted">
        <p>Learning similarity: {profile.semantic.learning.similarity.toFixed(2)}. {profile.semantic.learning.explanation}</p>
        <p>Teaching similarity: {profile.semantic.teaching.similarity.toFixed(2)}. {profile.semantic.teaching.explanation}</p>
        <p>Reciprocal score: {profile.semantic.score.toFixed(2)} (minimum directional cosine similarity; not a probability).</p>
      </div>}
      {onDecision && <div className="decision-buttons">
        <button type="button" onClick={() => onDecision("pass")} disabled={busy}><span aria-hidden="true">×</span> Pass</button>
        <button type="button" onClick={() => onDecision("like")} disabled={busy}><span aria-hidden="true">♥</span> Interested</button>
      </div>}
      <SafetyActions targetId={profile.id} onBlocked={() => onBlock?.(profile.id)} />
    </div>
  </article>;
}
