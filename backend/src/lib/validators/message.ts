import { Buffer } from "node:buffer";
import { z } from "zod";
import { DiscoveryError } from "../discovery/errors";

export const messageSchema = z.object({ body: z.string().trim().min(1).max(2000) }).strict();
const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
const cursorSchema = z.object({ v: z.literal(1), actor: uuid, match: uuid, created_at: z.string().datetime({ offset: true }), id: uuid }).strict();
export type MessageCursor = { created_at: string; id: string };

function invalid(): never {
  throw new DiscoveryError(400, "VALIDATION_ERROR", "Check your message pagination parameters.");
}

export function parseMessageQuery(url: string, actor: string, match: string) {
  const params = new URL(url).searchParams;
  for (const key of params.keys()) if (!["limit", "cursor"].includes(key) || params.getAll(key).length !== 1) invalid();
  const rawLimit = params.get("limit") ?? "30";
  if (!/^[1-9][0-9]?$/.test(rawLimit) || Number(rawLimit) > 50) invalid();
  const rawCursor = params.get("cursor");
  if (rawCursor === null) return { limit: Number(rawLimit), before: null as MessageCursor | null };
  if (!/^[A-Za-z0-9_-]{1,512}$/.test(rawCursor)) invalid();
  try {
    const decoded = Buffer.from(rawCursor, "base64url");
    if (decoded.toString("base64url") !== rawCursor) invalid();
    const cursor = cursorSchema.parse(JSON.parse(decoded.toString("utf8")));
    if (cursor.actor !== actor || cursor.match !== match) invalid();
    return { limit: Number(rawLimit), before: { created_at: cursor.created_at, id: cursor.id } };
  } catch { return invalid(); }
}

export function messageCursor(actor: string, match: string, cursor: MessageCursor) {
  return Buffer.from(JSON.stringify({ v: 1, actor, match, ...cursor })).toString("base64url");
}
