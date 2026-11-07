import { Buffer } from "node:buffer";
import { z } from "zod";
import { DiscoveryError } from "../discovery/errors";

export const discoveryUuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
const cursorSchema = z.object({ v: z.literal(3), actor: discoveryUuid, offset: z.number().int().min(0).max(5000), skill: discoveryUuid.nullable(), mode: z.enum(["online", "in_person"]).nullable(), skipped: z.boolean() }).strict();
const rankedCursorSchema = z.object({
  v: z.literal(4), actor: discoveryUuid,
  after: z.object({ id: discoveryUuid, reciprocal: z.boolean(), skills: z.number().int().min(0), preference: z.enum(["compatible", "incompatible", "unknown"]), level: z.number().int().min(0) }).strict(),
  skill: discoveryUuid.nullable(), mode: z.enum(["online", "in_person"]).nullable(), skipped: z.boolean(),
}).strict();
const semanticCursorSchema = z.object({ v: z.literal(2), actor: discoveryUuid, snapshot: discoveryUuid, offset: z.number().int().min(0).max(500) }).strict();
export type DiscoveryModeFilter = "online" | "in_person";
export type DiscoveryRankCursor = z.infer<typeof rankedCursorSchema>["after"];
export type DiscoveryQuery = { limit: number; offset: number; after: string | null; rankAfter?: DiscoveryRankCursor | null; semantic?: { snapshot: string; offset: number }; skillId: string | null; mode: DiscoveryModeFilter | null; includeSkipped: boolean };

function invalid(): never { throw new DiscoveryError(400, "VALIDATION_ERROR", "Check your discovery parameters."); }

export function parseDiscoveryQuery(url: string, actorId: string): DiscoveryQuery {
  const params = new URL(url).searchParams;
  for (const key of params.keys()) if (!["limit", "cursor", "skill", "mode", "include_skipped"].includes(key) || params.getAll(key).length !== 1) invalid();
  const rawLimit = params.get("limit") ?? "20";
  if (!/^[1-9][0-9]?$/.test(rawLimit) || Number(rawLimit) > 50) invalid();
  const skillId = params.get("skill");
  if (skillId !== null && !discoveryUuid.safeParse(skillId).success) invalid();
  const modeRaw = params.get("mode");
  if (modeRaw !== null && modeRaw !== "online" && modeRaw !== "in_person") invalid();
  const skippedRaw = params.get("include_skipped") ?? "false";
  if (skippedRaw !== "true" && skippedRaw !== "false") invalid();
  const filters = { skillId, mode: modeRaw as DiscoveryModeFilter | null, includeSkipped: skippedRaw === "true" };
  const cursor = params.get("cursor");
  if (cursor === null) return { limit: Number(rawLimit), offset: 0, after: null, rankAfter: null, ...filters };
  if (!/^[A-Za-z0-9_-]{1,384}$/.test(cursor)) invalid();
  try {
    const decoded = Buffer.from(cursor, "base64url");
    if (decoded.toString("base64url") !== cursor) invalid();
    const value = z.union([rankedCursorSchema, cursorSchema, semanticCursorSchema]).parse(JSON.parse(decoded.toString("utf8")));
    if (value.actor !== actorId) invalid();
    if (value.v === 4) {
      if (value.skill !== filters.skillId || value.mode !== filters.mode || value.skipped !== filters.includeSkipped) invalid();
      return { limit: Number(rawLimit), offset: 0, after: null, rankAfter: value.after, ...filters };
    }
    if (value.v === 2) {
      if (filters.skillId || filters.mode || filters.includeSkipped) invalid();
      return { limit: Number(rawLimit), offset: value.offset, after: null, rankAfter: null, ...filters, semantic: { snapshot: value.snapshot, offset: value.offset } };
    }
    if (value.skill !== filters.skillId || value.mode !== filters.mode || value.skipped !== filters.includeSkipped) invalid();
    return { limit: Number(rawLimit), offset: value.offset, after: null, rankAfter: null, ...filters };
  } catch { return invalid(); }
}

export function discoveryCursor(actor: string, candidate: { id: string; recommendation_type?: "reciprocal" | "one_way"; reciprocal_skill_count?: number; preference_compatible?: boolean; preference_fit?: "compatible" | "incompatible" | "unknown"; level_fit_count?: number }, query: DiscoveryQuery): string {
  const preference = candidate.preference_fit ?? (candidate.preference_compatible ? "compatible" : "unknown");
  return Buffer.from(JSON.stringify({
    v: 4, actor,
    after: { id: candidate.id, reciprocal: candidate.recommendation_type === "reciprocal", skills: candidate.reciprocal_skill_count ?? 0, preference, level: candidate.level_fit_count ?? 0 },
    skill: query.skillId, mode: query.mode, skipped: query.includeSkipped,
  })).toString("base64url");
}
