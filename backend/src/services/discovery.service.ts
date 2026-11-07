import "server-only";
import type { DiscoverResponse, DiscoveryCandidate } from "@shared/discovery";
import type { DiscoverySource } from "../models/discovery.model";
import { candidateRecommendation, compareRecommendations, rankRecommendations, skillsByDirection } from "../lib/discovery/matching";
import { discoveryCursor, type DiscoveryQuery } from "../lib/validators/discovery";
import { unavailable } from "../lib/discovery/errors";

export async function discover(source: DiscoverySource, actorId: string, query: DiscoveryQuery): Promise<DiscoverResponse> {
  query = { ...query, offset: query.offset ?? 0, after: query.after ?? null, rankAfter: query.rankAfter ?? null, skillId: query.skillId ?? null, mode: query.mode ?? null, includeSkipped: query.includeSkipped ?? false };
  const [profile, listings] = await Promise.all([source.ownProfile(actorId), source.skillsFor([actorId])]);
  const empty = (reason: DiscoverResponse["meta"]["reason"]): DiscoverResponse => ({ data: [], meta: { next_cursor: null, reason } });
  if (!profile) return empty("PROFILE_REQUIRED");
  const actor = skillsByDirection(listings);
  if (!actor.teaches.length || !actor.learns.length) return empty("SKILLS_REQUIRED");

  const eligible: DiscoveryCandidate[] = [];
  let after: string | null = null;
  let scanned = 0;
  while (scanned < 5000) {
    const profiles = await source.profilesAfter(after);
    if (!profiles.length) break;
    let previous = after;
    for (const candidate of profiles) {
      if (previous !== null && candidate.id <= previous) throw unavailable();
      previous = candidate.id;
    }
    scanned += profiles.length;
    const ids = profiles.filter((row) => row.id !== actorId).map((row) => row.id);
    const [skills, excluded] = await Promise.all([source.skillsFor(ids), source.swipedTargets(actorId, ids, query.includeSkipped)]);
    const skillsByUser = new Map<string, typeof skills>();
    for (const row of skills) skillsByUser.set(row.user_id, [...(skillsByUser.get(row.user_id) ?? []), row]);
    for (const candidate of profiles) {
      if (candidate.id === actorId || excluded.has(candidate.id)) continue;
      const candidateSkills = skillsByUser.get(candidate.id) ?? [];
      if (!candidateSkills.some((row) => row.direction === "teach") || !candidateSkills.some((row) => row.direction === "learn")) continue;
      if (query.mode && candidate.meeting_preference !== query.mode && candidate.meeting_preference !== "either") continue;
      const recommendation = candidateRecommendation(actor, profile.meeting_preference, listings, candidate, candidateSkills);
      if (!recommendation) continue;
      if (query.skillId && !recommendation.compatibility.you_can_learn.some((skill) => skill.id === query.skillId)) continue;
      eligible.push(recommendation);
    }
    after = profiles[profiles.length - 1].id;
  }
  const ranked = rankRecommendations(eligible);
  const remaining = query.rankAfter ? ranked.filter(candidate => compareRecommendations(candidate, {
    id: query.rankAfter!.id, recommendation_type: query.rankAfter!.reciprocal ? "reciprocal" : "one_way",
    reciprocal_skill_count: query.rankAfter!.skills, preference_fit: query.rankAfter!.preference,
    level_fit_count: query.rankAfter!.level,
  } as DiscoveryCandidate) > 0) : ranked;
  const data = remaining.slice(0, query.limit);
  const hasMore = remaining.length > data.length;
  return { data, meta: { next_cursor: hasMore ? discoveryCursor(actorId, data[data.length - 1], query) : null, reason: null } };
}
