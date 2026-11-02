import "server-only";
import type { DiscoverResponse, DiscoveryCandidate } from "@shared/discovery";
import type { DiscoverySource } from "../models/discovery.model";
import { complementaryCandidate, skillsByDirection } from "../lib/discovery/matching";
import { discoveryCursor, type DiscoveryQuery } from "../lib/validators/discovery";
import { unavailable } from "../lib/discovery/errors";

export async function discover(source: DiscoverySource, actorId: string, query: DiscoveryQuery): Promise<DiscoverResponse> {
  // Query both so an unavailable skills schema cannot masquerade as onboarding.
  const [profile, listings] = await Promise.all([source.ownProfile(actorId), source.skillsFor([actorId])]);
  const empty = (reason: DiscoverResponse["meta"]["reason"]): DiscoverResponse =>
    ({ data: [], meta: { next_cursor: null, reason } });
  if (!profile) return empty("PROFILE_REQUIRED");
  const actor = skillsByDirection(listings);
  if (!actor.teaches.length || !actor.learns.length) return empty("SKILLS_REQUIRED");

  const eligible: DiscoveryCandidate[] = [];
  let after = query.after;
  while (eligible.length <= query.limit) {
    const profiles = await source.profilesAfter(after);
    if (!profiles.length) break;
    // Fail closed if an adapter returns non-advancing/non-unique pages.
    let previous = after;
    for (const candidate of profiles) {
      if (previous !== null && candidate.id <= previous) throw unavailable();
      previous = candidate.id;
    }
    const ids = profiles.filter((row) => row.id !== actorId).map((row) => row.id);
    const [skills, swiped] = await Promise.all([source.skillsFor(ids), source.swipedTargets(actorId, ids)]);
    for (const candidate of profiles) {
      if (candidate.id === actorId || swiped.has(candidate.id)) continue;
      const match = complementaryCandidate(actor, candidate, skills.filter((row) => row.user_id === candidate.id));
      if (match) eligible.push(match);
      if (eligible.length > query.limit) break;
    }
    after = profiles[profiles.length - 1].id;
  }
  const data = eligible.slice(0, query.limit);
  return {
    data,
    // Cursor stays before the lookahead candidate, even if it is in another
    // scanned batch. Filtering never consumes candidates on the next page.
    meta: { next_cursor: eligible.length > query.limit ? discoveryCursor(actorId, data[data.length - 1].id) : null, reason: null },
  };
}
