import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { discoveryUuid } from "../lib/validators/discovery";
import { unavailable } from "../lib/discovery/errors";
import type { DiscoveryProfile, SkillListing } from "../lib/discovery/matching";

export interface DiscoverySource {
  ownProfile(actorId: string): Promise<DiscoveryProfile | null>;
  profilesAfter(after: string | null): Promise<DiscoveryProfile[]>;
  profilesFor(userIds: string[]): Promise<DiscoveryProfile[]>;
  skillsFor(userIds: string[]): Promise<SkillListing[]>;
  swipedTargets(actorId: string, targetIds: string[]): Promise<Set<string>>;
}

const profileSchema = z.object({ id: discoveryUuid, display_name: z.string(), bio: z.string() });
const listingSchema = z.object({
  user_id: discoveryUuid,
  skill_id: discoveryUuid,
  direction: z.enum(["teach", "learn"]),
  skills: z.object({ id: discoveryUuid, name: z.string() }),
}).refine((row) => row.skill_id === row.skills.id);
const swipeSchema = z.object({ target_id: discoveryUuid });
const BATCH_SIZE = 100;

// A fresh source uses the caller's authenticated client; RLS remains authoritative.
export function discoveryModel(client: SupabaseClient): DiscoverySource {
  async function read<T>(query: PromiseLike<T>): Promise<T> {
    try { return await query; } catch { throw unavailable(); }
  }
  // Exhaust each related query explicitly. Never treat a short server-capped
  // response as exhaustion or silently truncate skills/swipe exclusions.
  async function readPages<T>(query: (offset: number) => PromiseLike<{ data: unknown; error: unknown; count: number | null }>, schema: z.ZodType<T>): Promise<T[]> {
    const rows: T[] = [];
    for (;;) {
      const result = await read(query(rows.length));
      if (result.error) throw unavailable();
      const parsed = z.array(schema).safeParse(result.data);
      if (!parsed.success || result.count === null || result.count < 0) throw unavailable();
      rows.push(...parsed.data);
      if (rows.length >= result.count) return rows;
      if (!parsed.data.length) throw unavailable();
    }
  }

  return {
    async profilesFor(userIds) {
      if (!userIds.length) return [];
      return readPages((offset) => client.from("profiles").select("id,display_name,bio", { count: "exact" })
        .in("id", userIds).order("id").range(offset, offset + BATCH_SIZE - 1), profileSchema);
    },
    async ownProfile(actorId) {
      const { data, error } = await read(client.from("profiles").select("id,display_name,bio").eq("id", actorId).maybeSingle());
      if (error) throw unavailable();
      if (data === null) return null;
      const parsed = profileSchema.safeParse(data);
      if (!parsed.success) throw unavailable();
      return parsed.data;
    },
    async profilesAfter(after) {
      let query = client.from("profiles").select("id,display_name,bio").order("id", { ascending: true }).limit(BATCH_SIZE);
      if (after) query = query.gt("id", after);
      const { data, error } = await read(query);
      if (error) throw unavailable();
      const parsed = z.array(profileSchema).safeParse(data);
      if (!parsed.success) throw unavailable();
      return parsed.data;
    },
    async skillsFor(userIds) {
      if (!userIds.length) return [];
      const rows = await readPages((offset) => client.from("user_skills")
        .select("user_id,skill_id,direction,skills!inner(id,name)", { count: "exact" }).in("user_id", userIds)
        .order("user_id").order("skill_id").order("direction")
        .range(offset, offset + BATCH_SIZE - 1), listingSchema);
      return rows.map(({ skills, ...row }) => ({ ...row, skill: skills }));
    },
    async swipedTargets(actorId, targetIds) {
      if (!targetIds.length) return new Set();
      const rows = await readPages((offset) => client.from("swipes").select("target_id", { count: "exact" })
        .eq("actor_id", actorId).in("target_id", targetIds).order("target_id")
        .range(offset, offset + BATCH_SIZE - 1), swipeSchema);
      return new Set(rows.map((row) => row.target_id));
    },
  };
}
