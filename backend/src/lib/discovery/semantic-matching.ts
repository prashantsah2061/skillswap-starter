import type { Skill } from "@shared/domain";
import type { DiscoveryCandidate, SemanticEvidence } from "@shared/discovery";
import { skillsByDirection, type DiscoveryProfile, type SkillListing } from "./matching";

export type CanonicalSkill = Skill & { description?: string };
export const EMBEDDING_FORMAT = "canonical-skill-v1";
export function skillContent(skill: CanonicalSkill): string {
  return JSON.stringify({ name: skill.name.normalize("NFKC").trim(), description: (skill.description || "").normalize("NFKC").trim() });
}

export function cosine(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length || [...a, ...b].some(value => !Number.isFinite(value))) throw new Error("Invalid embedding");
  const normA = Math.hypot(...a), normB = Math.hypot(...b);
  if (!normA || !normB) throw new Error("Invalid embedding");
  return Math.max(-1, Math.min(1, a.reduce((sum, value, index) => sum + value * b[index], 0) / normA / normB));
}

export function directionalMatch(offered: CanonicalSkill[], wanted: CanonicalSkill[], vectors: Map<string, number[]>): SemanticEvidence | null {
  let best: SemanticEvidence | null = null;
  for (const offer of [...offered].sort((a, b) => a.id.localeCompare(b.id))) {
    for (const want of [...wanted].sort((a, b) => a.id.localeCompare(b.id))) {
      const kind = offer.id === want.id ? "exact" : "related";
      const similarity = kind === "exact" ? 1 : cosine(vectors.get(skillContent(offer)) || [], vectors.get(skillContent(want)) || []);
      if (!best || similarity > best.similarity || (similarity === best.similarity && kind === "exact" && best.kind !== "exact")) {
        best = { offered: { id: offer.id, name: offer.name }, wanted: { id: want.id, name: want.name }, kind, similarity,
          explanation: kind === "exact" ? `Offered “${offer.name}” matches the requested catalog skill exactly.`
            : `Offered “${offer.name}” and requested “${want.name}” have related canonical content; they are different catalog skills. Confirm that the offered teaching covers the learning goal.` };
      }
    }
  }
  return best;
}

export function semanticCandidate(actor: ReturnType<typeof skillsByDirection>, profile: DiscoveryProfile, listings: SkillListing[], vectors: Map<string, number[]>, threshold: number): DiscoveryCandidate | null {
  const candidate = skillsByDirection(listings);
  const learning = directionalMatch(candidate.teaches, actor.learns, vectors);
  const teaching = directionalMatch(actor.teaches, candidate.learns, vectors);
  if (!learning || !teaching || learning.similarity < threshold || teaching.similarity < threshold) return null;
  return { ...profile, ...candidate,
    compatibility: { you_can_learn: [learning.offered], you_can_teach: [teaching.offered] },
    semantic: { learning, teaching, score: Math.min(learning.similarity, teaching.similarity), score_kind: "cosine_similarity" },
  };
}
