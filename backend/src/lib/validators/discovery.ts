import { Buffer } from "node:buffer";
import { z } from "zod";
import { DiscoveryError } from "../discovery/errors";

// PostgreSQL UUID ordering agrees with lexicographic canonical lowercase UUIDs.
export const discoveryUuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
const cursorSchema = z.object({ v: z.literal(1), actor: discoveryUuid, after: discoveryUuid }).strict();
const semanticCursorSchema = z.object({ v: z.literal(2), actor: discoveryUuid, snapshot: discoveryUuid, offset: z.number().int().min(0).max(500) }).strict();
export type DiscoveryQuery = { limit: number; after: string | null; semantic?: { snapshot: string; offset: number } };

function invalid(): never {
  throw new DiscoveryError(400, "VALIDATION_ERROR", "Check your discovery parameters.");
}

export function parseDiscoveryQuery(url: string, actorId: string): DiscoveryQuery {
  const params = new URL(url).searchParams;
  for (const key of params.keys()) {
    if (!["limit", "cursor"].includes(key) || params.getAll(key).length !== 1) invalid();
  }
  const rawLimit = params.get("limit") ?? "20";
  if (!/^[1-9][0-9]?$/.test(rawLimit) || Number(rawLimit) > 50) invalid();
  const cursor = params.get("cursor");
  if (cursor === null) return { limit: Number(rawLimit), after: null };
  if (!/^[A-Za-z0-9_-]{1,384}$/.test(cursor)) invalid();
  try {
    const decoded = Buffer.from(cursor, "base64url");
    if (decoded.toString("base64url") !== cursor) invalid();
    const value = z.union([cursorSchema, semanticCursorSchema]).parse(JSON.parse(decoded.toString("utf8")));
    if (value.actor !== actorId) invalid();
    return value.v === 1 ? { limit: Number(rawLimit), after: value.after }
      : { limit: Number(rawLimit), after: null, semantic: { snapshot: value.snapshot, offset: value.offset } };
  } catch { return invalid(); }
}

export function discoveryCursor(actor: string, after: string): string {
  return Buffer.from(JSON.stringify({ v: 1, actor, after })).toString("base64url");
}
