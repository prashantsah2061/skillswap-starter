import type { Skill } from "./domain";

export type SemanticEvidence = {
  offered: Skill; wanted: Skill; kind: "exact" | "related";
  similarity: number; explanation: string;
};

export type DiscoveryCandidate = {
  id: string;
  display_name: string;
  bio: string;
  meeting_preference?: "online" | "in_person" | "either" | null;
  recommendation_type?: "reciprocal" | "one_way";
  recommendation_reason?: string;
  preference_compatible?: boolean;
  preference_fit?: "compatible" | "incompatible" | "unknown";
  level_fit_count?: number;
  reciprocal_skill_count?: number;
  teaches: Skill[];
  learns: Skill[];
  compatibility: { you_can_learn: Skill[]; you_can_teach: Skill[] };
  semantic?: { learning: SemanticEvidence; teaching: SemanticEvidence; score: number; score_kind: "cosine_similarity" };
};

export type DiscoverResponse = {
  data: DiscoveryCandidate[];
  meta: {
    next_cursor: string | null;
    reason: "PROFILE_REQUIRED" | "SKILLS_REQUIRED" | null;
    matching?: { mode: "semantic" | "baseline"; fallback_reason?: string; model_version?: string; threshold?: number };
  };
};

export type PendingInterest = { created_at: string; partner: Pick<DiscoveryCandidate, "id" | "display_name" | "bio" | "meeting_preference"> };

export type DiscoveryErrorResponse = { error: { code: string; message: string } };
