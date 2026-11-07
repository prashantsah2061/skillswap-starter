import type { Skill } from "@shared/domain";
import type { DiscoveryCandidate } from "@shared/discovery";

export type DiscoveryProfile = { id: string; display_name: string; bio: string; meeting_preference: "online" | "in_person" | "either" | null };
export type SkillListing = { user_id: string; skill_id: string; direction: "teach" | "learn"; level: "beginner" | "intermediate" | "advanced"; goal_level: "beginner" | "intermediate" | "advanced" | null; skill: Skill };

export function skillsByDirection(listings: SkillListing[]) {
  const select = (direction: SkillListing["direction"]) =>
    listings.filter((row) => row.direction === direction).map((row) => row.skill)
      .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return { teaches: select("teach"), learns: select("learn") };
}

/** Exact stable skill IDs are the only source of personalized fit claims. */
export function candidateRecommendation(
  actor: ReturnType<typeof skillsByDirection>,
  actorPreference: DiscoveryProfile["meeting_preference"],
  actorListings: SkillListing[],
  candidate: DiscoveryProfile,
  listings: SkillListing[],
): DiscoveryCandidate | null {
  const skills = skillsByDirection(listings);
  const learnIds = new Set(actor.learns.map((skill) => skill.id));
  const teachIds = new Set(actor.teaches.map((skill) => skill.id));
  const you_can_learn = skills.teaches.filter((skill) => learnIds.has(skill.id));
  const you_can_teach = skills.learns.filter((skill) => teachIds.has(skill.id));
  if (!you_can_learn.length && !you_can_teach.length) return null;
  const reciprocal = you_can_learn.length > 0 && you_can_teach.length > 0;
  const levelOrder = { beginner: 0, intermediate: 1, advanced: 2 } as const;
  const actorTeach = new Map(actorListings.filter(row => row.direction === "teach").map(row => [row.skill_id, row.level]));
  const actorGoals = new Map(actorListings.filter(row => row.direction === "learn").map(row => [row.skill_id, row.goal_level]));
  const candidateTeach = new Map(listings.filter(row => row.direction === "teach").map(row => [row.skill_id, row.level]));
  const candidateGoals = new Map(listings.filter(row => row.direction === "learn").map(row => [row.skill_id, row.goal_level]));
  const levelFitCount = you_can_learn.filter(skill => {
    const goal = actorGoals.get(skill.id), teacher = candidateTeach.get(skill.id);
    return goal !== null && goal !== undefined && teacher !== undefined && levelOrder[teacher] >= levelOrder[goal];
  }).length + you_can_teach.filter(skill => {
    const goal = candidateGoals.get(skill.id), teacher = actorTeach.get(skill.id);
    return goal !== null && goal !== undefined && teacher !== undefined && levelOrder[teacher] >= levelOrder[goal];
  }).length;
  const preferenceFit = !actorPreference || !candidate.meeting_preference ? "unknown"
    : actorPreference === "either" || candidate.meeting_preference === "either" || actorPreference === candidate.meeting_preference ? "compatible" : "incompatible";
  const examples = [you_can_learn[0]?.name, you_can_teach[0]?.name].filter(Boolean);
  return {
    ...candidate,
    ...skills,
    recommendation_type: reciprocal ? "reciprocal" : "one_way",
    compatibility: { you_can_learn, you_can_teach },
    recommendation_reason: reciprocal
      ? `You can exchange ${examples.join(" and ")}.`
      : you_can_learn.length ? `They teach ${you_can_learn[0].name}, which you want to learn.` : `They want to learn ${you_can_teach[0].name}, which you can teach.`,
    meeting_preference: candidate.meeting_preference,
    preference_compatible: preferenceFit === "compatible",
    preference_fit: preferenceFit,
    level_fit_count: levelFitCount,
    reciprocal_skill_count: you_can_learn.length + you_can_teach.length,
  };
}

export function compareRecommendations(a: DiscoveryCandidate, b: DiscoveryCandidate) {
  const preferenceRank = { compatible: 2, unknown: 1, incompatible: 0 } as const;
  return (
    Number(b.recommendation_type === "reciprocal") - Number(a.recommendation_type === "reciprocal") ||
    (b.reciprocal_skill_count ?? 0) - (a.reciprocal_skill_count ?? 0) ||
    (preferenceRank[b.preference_fit ?? (b.preference_compatible ? "compatible" : "unknown")] -
      preferenceRank[a.preference_fit ?? (a.preference_compatible ? "compatible" : "unknown")]) ||
    (b.level_fit_count ?? 0) - (a.level_fit_count ?? 0) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

export function rankRecommendations(candidates: DiscoveryCandidate[]) {
  return [...candidates].sort(compareRecommendations);
}

/** Compatibility export retained for existing unit-level callers. */
export function complementaryCandidate(actor: ReturnType<typeof skillsByDirection>, candidate: DiscoveryProfile, listings: SkillListing[]) {
  const result = candidateRecommendation(actor, null, [], candidate, listings);
  return result?.recommendation_type === "reciprocal" ? result : null;
}
