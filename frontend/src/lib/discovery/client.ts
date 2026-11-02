import { z } from "zod";

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
const skill = z.object({ id: uuid, name: z.string() });
const listing = z.object({ skill_id: uuid, direction: z.enum(["teach", "learn"]), level: z.enum(["beginner", "intermediate", "advanced"]) });
const publicProfile = z.object({ id: uuid, display_name: z.string(), bio: z.string() });
const evidence = z.object({ offered: skill, wanted: skill, kind: z.enum(["exact", "related"]), similarity: z.number().min(-1).max(1), explanation: z.string() });
const discovery = z.object({
  data: z.array(publicProfile.extend({
    teaches: z.array(skill), learns: z.array(skill),
    compatibility: z.object({ you_can_learn: z.array(skill), you_can_teach: z.array(skill) }),
    semantic: z.object({ learning: evidence, teaching: evidence, score: z.number().min(-1).max(1), score_kind: z.literal("cosine_similarity") }).optional(),
  })),
  meta: z.object({ next_cursor: z.string().nullable(), reason: z.enum(["PROFILE_REQUIRED", "SKILLS_REQUIRED"]).nullable(),
    matching: z.object({ mode: z.enum(["semantic", "baseline"]), fallback_reason: z.string().optional(), model_version: z.string().optional(), threshold: z.number().optional() }).optional() }),
});
export type PublicSkill = z.infer<typeof skill>;
export type PublicSelection = Pick<z.infer<typeof listing>, "skill_id" | "direction">;
export class PublicApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) { super(message); }
}

async function api<T>(url: string, schema: z.ZodType<T>, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...options, credentials: "same-origin", cache: "no-store" });
  let body;
  try { body = await response.json(); } catch { throw new PublicApiError(503, "DISCOVERY_UNAVAILABLE", "The service is temporarily unavailable."); }
  if (!response.ok) {
    throw new PublicApiError(response.status, body?.error?.code || "DISCOVERY_UNAVAILABLE", body?.error?.message || "The request could not be completed.");
  }
  const result = schema.safeParse(body);
  if (!result.success) throw new PublicApiError(503, "DISCOVERY_UNAVAILABLE", "The service returned an invalid response.");
  return result.data;
}
const write = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const selectionKey = (value: PublicSelection) => `${value.skill_id}:${value.direction}`;

export async function loadPublicOnboarding(signal?: AbortSignal) {
  const [profile, catalog, selections] = await Promise.all([
    api("/api/public-profile", z.object({ data: publicProfile.nullable() }), { signal }),
    api("/api/skills", z.object({ data: z.array(skill) }), { signal }),
    api("/api/user-skills", z.object({ data: z.array(listing) }), { signal }),
  ]);
  return { profile: profile.data, catalog: catalog.data, selections: selections.data };
}

export async function savePublicOnboarding(profile: { display_name: string; bio: string }, desired: PublicSelection[]) {
  // Fresh persisted state makes retries reconcile a partially completed save.
  // Never derive public data from private account profiles or demo preferences.
  const current = await api("/api/user-skills", z.object({ data: z.array(listing) }));
  await api("/api/public-profile", z.object({ data: publicProfile }), write("PATCH", profile));
  const oldKeys = new Set(current.data.map(selectionKey));
  const wanted = new Set(desired.map(selectionKey));
  const resultSchema = z.object({ data: listing.pick({ skill_id: true, direction: true }) });
  for (const value of desired) {
    if (!oldKeys.has(selectionKey(value))) await api("/api/user-skills", resultSchema, write("POST", { skill_id: value.skill_id, direction: value.direction }));
  }
  for (const value of current.data) {
    if (!wanted.has(selectionKey(value))) await api("/api/user-skills", resultSchema, write("DELETE", { skill_id: value.skill_id, direction: value.direction }));
  }
  const saved = await api("/api/user-skills", z.object({ data: z.array(listing) }));
  const savedKeys = new Set(saved.data.map(selectionKey));
  if (savedKeys.size !== wanted.size || [...wanted].some(key => !savedKeys.has(key))) {
    throw new PublicApiError(409, "PROFILE_CHANGED", "Your skills changed during saving. Reload and review them.");
  }
}

export function loadDiscovery(cursor: string | null = null, signal?: AbortSignal) {
  return api(`/api/discover?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, discovery, { signal });
}
