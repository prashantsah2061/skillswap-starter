import type { Skill } from "@shared/domain";
import type { DiscoveryCandidate } from "@shared/discovery";

export type DiscoveryProfile = { id: string; display_name: string; bio: string };
export type SkillListing = { user_id: string; skill_id: string; direction: "teach" | "learn"; skill: Skill };

export function skillsByDirection(listings: SkillListing[]) {
  const select = (direction: SkillListing["direction"]) =>
    listings.filter((row) => row.direction === direction).map((row) => row.skill)
      .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return { teaches: select("teach"), learns: select("learn") };
}

// Pure eligibility/explanation logic. Data access, cursors, and HTTP stay outside
// so a later semantic matcher/ranker can be introduced independently.
export function complementaryCandidate(
  actor: ReturnType<typeof skillsByDirection>,
  candidate: DiscoveryProfile,
  listings: SkillListing[],
): DiscoveryCandidate | null {
  const skills = skillsByDirection(listings);
  const learnIds = new Set(actor.learns.map((skill) => skill.id));
  const teachIds = new Set(actor.teaches.map((skill) => skill.id));
  const you_can_learn = skills.teaches.filter((skill) => learnIds.has(skill.id));
  const you_can_teach = skills.learns.filter((skill) => teachIds.has(skill.id));
  if (!you_can_learn.length || !you_can_teach.length) return null;
  return { ...candidate, ...skills, compatibility: { you_can_learn, you_can_teach } };
}
