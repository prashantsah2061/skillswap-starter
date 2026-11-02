import "server-only";
import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import type { DiscoveryCandidate, DiscoverResponse } from "@shared/discovery";
import type { DiscoverySource } from "../models/discovery.model";
import { DiscoveryError, unavailable } from "../lib/discovery/errors";
import { skillsByDirection, type SkillListing } from "../lib/discovery/matching";
import { semanticCandidate, skillContent } from "../lib/discovery/semantic-matching";
import { embedSkills, embeddingVersion, SemanticUnavailable } from "../lib/discovery/embeddings";
import { semanticEnabled, semanticSettings } from "../lib/discovery/semantic-config";
import type { DiscoveryQuery } from "../lib/validators/discovery";
import { discover } from "@/services/discovery.service";

type Ranked = { candidate: DiscoveryCandidate; fingerprint: string };
type Snapshot = { actor: string; actorFingerprint: string; expires: number; ranked: Ranked[]; version: string; threshold: number };
// Bounded process-local ephemeral snapshots, never an authenticated client cache.
const snapshots = new Map<string, Snapshot>();
const TTL = 300000;
function fingerprint(rows: SkillListing[]) {
  return createHash("sha256").update(JSON.stringify(rows.map(row => `${row.skill_id}:${row.direction}:${skillContent(row.skill)}`).sort())).digest("hex");
}
function expired(): never { throw new DiscoveryError(409, "CURSOR_EXPIRED", "Recommendations changed or expired. Restart discovery."); }
async function baseline(source: DiscoverySource, actor: string, query: DiscoveryQuery, reason?: string) {
  const result = await discover(source, actor, query);
  result.meta.matching = { mode: "baseline", ...(reason ? { fallback_reason: reason } : {}) };
  return result;
}

async function page(source: DiscoverySource, actor: string, query: DiscoveryQuery, token: string, snapshot: Snapshot): Promise<DiscoverResponse> {
  if (snapshot.actor !== actor || snapshot.expires <= Date.now()) expired();
  const [profile, actorListings] = await Promise.all([source.ownProfile(actor), source.skillsFor([actor])]);
  if (!profile || fingerprint(actorListings) !== snapshot.actorFingerprint) expired();
  const offset = query.semantic?.offset || 0;
  if (offset > snapshot.ranked.length) expired();
  const visible = new Map<string, DiscoveryCandidate>();
  // Recheck current RLS visibility, skills and swipes on every continuation;
  // neither a cached public profile nor a similarity score grants access.
  for (let start = offset; start < snapshot.ranked.length; start += 100) {
    const slice = snapshot.ranked.slice(start, start + 100);
    const ids = slice.map(row => row.candidate.id);
    const [profiles, listings, swiped] = await Promise.all([
      source.profilesFor(ids), source.skillsFor(ids), source.swipedTargets(actor, ids),
    ]);
    for (const profile of profiles) {
      if (profile.id === actor || swiped.has(profile.id)) continue;
      const frozen = slice.find(row => row.candidate.id === profile.id)!;
      if (!frozen || fingerprint(listings.filter(row => row.user_id === profile.id)) !== frozen.fingerprint) continue;
      visible.set(profile.id, { ...frozen.candidate, ...profile });
    }
  }
  const eligible = snapshot.ranked.map((row, index) => ({ candidate: visible.get(row.candidate.id), index }))
    .filter(row => row.index >= offset && row.candidate).slice(0, query.limit + 1);
  const returned = eligible.slice(0, query.limit);
  const next_cursor = eligible.length > query.limit ? Buffer.from(JSON.stringify({ v: 2, actor, snapshot: token, offset: returned[returned.length - 1].index + 1 })).toString("base64url") : null;
  return { data: returned.map(row => row.candidate!), meta: { reason: null, next_cursor,
    matching: { mode: "semantic", model_version: snapshot.version, threshold: snapshot.threshold } } };
}

export async function discoverWithSemantics(source: DiscoverySource, actor: string, query: DiscoveryQuery): Promise<DiscoverResponse> {
  if (query.semantic) {
    if (!semanticEnabled()) expired();
    const snapshot = snapshots.get(query.semantic.snapshot);
    if (!snapshot) expired();
    return page(source, actor, query, query.semantic.snapshot, snapshot);
  }
  // A baseline continuation never switches to a different global ordering.
  if (!semanticEnabled()) return discover(source, actor, query);
  if (query.after) return baseline(source, actor, query, "BASELINE_CONTINUATION");
  try {
    const settings = semanticSettings();
    const [profile, actorListings] = await Promise.all([source.ownProfile(actor), source.skillsFor([actor])]);
    const own = skillsByDirection(actorListings);
    if (!profile || !own.teaches.length || !own.learns.length) return baseline(source, actor, query);
    const candidates: Array<{ profile: typeof profile; listings: SkillListing[] }> = [];
    let after: string | null = null, scanned = 0;
    for (;;) {
      const profiles = await source.profilesAfter(after);
      if (!profiles.length) break;
      let previous = after;
      for (const candidate of profiles) {
        if (previous !== null && candidate.id <= previous) throw unavailable();
        previous = candidate.id;
      }
      scanned += profiles.length;
      if (scanned > settings.maxProfiles) throw new SemanticUnavailable("CANDIDATE_LIMIT");
      const ids = profiles.filter(row => row.id !== actor).map(row => row.id);
      const swiped = await source.swipedTargets(actor, ids);
      const allowed = profiles.filter(row => row.id !== actor && !swiped.has(row.id));
      const listings = await source.skillsFor(allowed.map(row => row.id));
      for (const candidate of allowed) {
        const rows = listings.filter(row => row.user_id === candidate.id);
        if (rows.some(row => row.direction === "teach") && rows.some(row => row.direction === "learn")) candidates.push({ profile: candidate, listings: rows });
      }
      after = profiles[profiles.length - 1].id;
    }
    // Exact overlap is intentionally NOT an eligibility prefilter here.
    const vectors = candidates.length ? await embedSkills([...actorListings, ...candidates.flatMap(row => row.listings)].map(row => row.skill), settings) : new Map<string, number[]>();
    const ranked = candidates.flatMap(row => {
      const candidate = semanticCandidate(own, row.profile, row.listings, vectors, settings.threshold);
      return candidate ? [{ candidate, fingerprint: fingerprint(row.listings) }] : [];
    }).sort((a, b) => b.candidate.semantic!.score - a.candidate.semantic!.score || (a.candidate.id < b.candidate.id ? -1 : 1));
    const snapshot: Snapshot = { actor, actorFingerprint: fingerprint(actorListings), ranked, expires: Date.now() + TTL,
      version: embeddingVersion(settings.revision), threshold: settings.threshold };
    const token = randomUUID();
    for (const [id, saved] of snapshots) if (saved.expires <= Date.now()) snapshots.delete(id);
    snapshots.set(token, snapshot);
    while (snapshots.size > 50) snapshots.delete(snapshots.keys().next().value!);
    return page(source, actor, query, token, snapshot);
  } catch (error) {
    if (error instanceof SemanticUnavailable) return baseline(source, actor, query, error.reason);
    throw error; // Database/authorization failures never turn into recommendations.
  }
}
