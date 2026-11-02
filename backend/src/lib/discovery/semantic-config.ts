import "server-only";
import { readFileSync, statSync } from "node:fs";
import { z } from "zod";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, SemanticUnavailable, type EmbeddingSettings } from "./embeddings";
import { EMBEDDING_FORMAT } from "./semantic-matching";

export type SemanticSettings = EmbeddingSettings & { threshold: number; maxProfiles: number };
export function semanticEnabled() { return process.env.SEMANTIC_SKILL_MATCHING === "true"; }
export function semanticSettings(): SemanticSettings {
  const key = process.env.OPENAI_API_KEY, revision = process.env.SKILL_EMBEDDING_REVISION;
  if (!key || !revision || revision.length > 80) throw new SemanticUnavailable("CONFIGURATION");
  const threshold = Number(process.env.SKILL_MATCH_THRESHOLD || "0.8");
  const maxProfiles = Number(process.env.SKILL_MATCH_MAX_PROFILES || "200");
  if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1 || !Number.isInteger(maxProfiles) || maxProfiles < 1 || maxProfiles > 500) throw new SemanticUnavailable("CONFIGURATION");
  // A synthetic vector fixture is not evidence for a real provider threshold.
  // Only an actual provider evaluation can authorize this model/format/revision.
  try {
    const path = process.env.SKILL_MATCH_EVALUATION_REPORT;
    if (!path || statSync(path).size > 65536) throw new Error();
    const report = z.object({ provider: z.literal("openai"), model: z.literal(EMBEDDING_MODEL),
      dimensions: z.literal(EMBEDDING_DIMENSIONS), format: z.literal(EMBEDDING_FORMAT), revision: z.literal(revision),
      input: z.literal("names-only"), evaluated_thresholds: z.array(z.number()), heldout_count: z.number().int().min(1),
    }).parse(JSON.parse(readFileSync(path, "utf8")));
    if (!report.evaluated_thresholds.includes(threshold)) throw new Error();
  } catch { throw new SemanticUnavailable("EVALUATION_REQUIRED"); }
  return { key, revision, threshold, maxProfiles };
}
