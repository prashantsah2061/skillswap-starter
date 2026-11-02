import "server-only";
import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { z } from "zod";
import { EMBEDDING_FORMAT, skillContent, type CanonicalSkill } from "./semantic-matching";

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 256;
export const MAX_EMBEDDING_SKILLS = 64;
export class SemanticUnavailable extends Error {
  constructor(public readonly reason: "PROVIDER_UNAVAILABLE" | "PROVIDER_BUDGET" | "CATALOG_LIMIT" | "CANDIDATE_LIMIT" | "CONFIGURATION" | "EVALUATION_REQUIRED") { super(reason); }
}
export type EmbeddingSettings = { revision: string; key: string };
const cache = new Map<string, { expires: number; vector: number[] }>();
let inFlight = false;
let windowStart = 0, attempts = 0, reservedBytes = 0;
const HOUR = 3600000;
export function embeddingVersion(revision: string) { return `${EMBEDDING_MODEL}:${revision}:${EMBEDDING_DIMENSIONS}:${EMBEDDING_FORMAT}`; }
export function embeddingKey(skill: CanonicalSkill, revision: string) {
  return createHash("sha256").update(embeddingVersion(revision) + ":" + skillContent(skill)).digest("hex");
}

export async function embedSkills(skills: CanonicalSkill[], settings: EmbeddingSettings): Promise<Map<string, number[]>> {
  const unique = new Map(skills.map(skill => [skillContent(skill), skill]));
  if (unique.size > MAX_EMBEDDING_SKILLS) throw new SemanticUnavailable("CATALOG_LIMIT");
  const result = new Map<string, number[]>(), missing: CanonicalSkill[] = [];
  const now = Date.now();
  for (const [content, skill] of unique) {
    if (Buffer.byteLength(content, "utf8") > 512) throw new SemanticUnavailable("CATALOG_LIMIT");
    const value = cache.get(embeddingKey(skill, settings.revision));
    if (value && value.expires > now) result.set(content, [...value.vector]);
    else missing.push(skill);
  }
  if (!missing.length) return result;
  if (!settings.key || !settings.revision) throw new SemanticUnavailable("CONFIGURATION");
  // Reserve worst-case UTF-8 input bytes plus overhead before each paid call.
  // Single batch, zero retries, one concurrent call, 16 calls / 128 KiB per hour
  // per process. Failed calls consume the reservation too.
  if (now - windowStart >= HOUR) { windowStart = now; attempts = 0; reservedBytes = 0; }
  const input = missing.map(skillContent);
  const bytes = input.reduce((sum, value) => sum + Buffer.byteLength(value, "utf8"), 1024);
  if (inFlight || attempts >= 16 || reservedBytes + bytes > 131072) throw new SemanticUnavailable("PROVIDER_BUDGET");
  attempts++; reservedBytes += bytes; inFlight = true;
  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST", headers: { Authorization: `Bearer ${settings.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMBEDDING_MODEL, dimensions: EMBEDDING_DIMENSIONS, encoding_format: "float", input }),
      signal: AbortSignal.timeout(4000), redirect: "error", cache: "no-store",
    });
    if (!response.ok) { await response.body?.cancel(); throw new SemanticUnavailable("PROVIDER_UNAVAILABLE"); }
    // Bound output memory, including chunked provider responses.
    const reader = response.body?.getReader();
    if (!reader) throw new SemanticUnavailable("PROVIDER_UNAVAILABLE");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1048576) { await reader.cancel(); throw new SemanticUnavailable("PROVIDER_UNAVAILABLE"); }
      chunks.push(value);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const parsed = z.object({ model: z.literal(EMBEDDING_MODEL), data: z.array(z.object({
      index: z.number().int().min(0), embedding: z.array(z.number().finite()).length(EMBEDDING_DIMENSIONS),
    })).length(missing.length) }).parse(body);
    const indexes = new Set(parsed.data.map(row => row.index));
    if (indexes.size !== missing.length || parsed.data.some(row => row.index >= missing.length || !Math.hypot(...row.embedding))) throw new SemanticUnavailable("PROVIDER_UNAVAILABLE");
    for (const row of parsed.data) {
      const skill = missing[row.index];
      const key = embeddingKey(skill, settings.revision);
      cache.delete(key);
      cache.set(key, { vector: row.embedding, expires: now + 86400000 });
      result.set(skillContent(skill), [...row.embedding]);
    }
    while (cache.size > 1024) cache.delete(cache.keys().next().value!);
    return result;
  } catch { throw new SemanticUnavailable("PROVIDER_UNAVAILABLE"); }
  finally { inFlight = false; }
}
