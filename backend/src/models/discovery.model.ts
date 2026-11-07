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
  swipedTargets(actorId: string, targetIds: string[], includeSkipped?: boolean): Promise<Set<string>>;
}

const profileSchema = z.object({ id: discoveryUuid, display_name: z.string(), bio: z.string(), meeting_preference: z.enum(["online", "in_person", "either"]).nullable() });
const listingSchema = z.object({
  user_id: discoveryUuid,
  skill_id: discoveryUuid,
  direction: z.enum(["teach", "learn"]),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  goal_level: z.enum(["beginner", "intermediate", "advanced"]).nullable(),
  skills: z.object({ id: discoveryUuid, name: z.string() }),
}).refine((row) => row.skill_id === row.skills.id);
const swipeSchema = z.object({ target_id: discoveryUuid, decision: z.enum(["like", "pass"]) });
const matchSchema = z.object({ user_a: discoveryUuid, user_b: discoveryUuid });
const BATCH_SIZE = 100;
const EXCLUSION_PAGE_SIZE = 500;

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
      return readPages((offset) => client.from("profiles").select("id,display_name,bio,meeting_preference", { count: "exact" })
        .in("id", userIds).eq("visible", true).eq("onboarded", true).is("suspended_at", null)
        .order("id").range(offset, offset + BATCH_SIZE - 1), profileSchema);
    },
    async ownProfile(actorId) {
      const { data, error } = await read(client.from("profiles").select("id,display_name,bio,meeting_preference").eq("id", actorId).is("suspended_at", null).maybeSingle());
      if (error) throw unavailable();
      if (data === null) return null;
      const parsed = profileSchema.safeParse(data);
      if (!parsed.success) throw unavailable();
      return parsed.data;
    },
    async profilesAfter(after) {
      let query = client.from("profiles").select("id,display_name,bio,meeting_preference")
        .eq("visible", true).eq("onboarded", true).is("suspended_at", null)
        .order("id", { ascending: true }).limit(BATCH_SIZE);
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
        .select("user_id,skill_id,direction,level,goal_level,skills!inner(id,name)", { count: "exact" }).in("user_id", userIds)
        .order("user_id").order("skill_id").order("direction")
        .range(offset, offset + BATCH_SIZE - 1), listingSchema);
      return rows.map(({ skills, ...row }) => ({ ...row, skill: skills }));
    },
    async swipedTargets(actorId, targetIds, includeSkipped = false) {
      const excluded = new Set<string>();
      for (let offset = 0; ; offset += EXCLUSION_PAGE_SIZE) {
        const { data: hidden, error: hiddenError } = await client.rpc("get_hidden_user_ids_page", {
          p_offset: offset, p_limit: EXCLUSION_PAGE_SIZE,
        });
        const parsedHidden = z.array(z.object({ user_id: discoveryUuid })).safeParse(hidden);
        if (hiddenError || !parsedHidden.success || parsedHidden.data.length > EXCLUSION_PAGE_SIZE) throw unavailable();
        parsedHidden.data.forEach(row => excluded.add(row.user_id));
        if (parsedHidden.data.length < EXCLUSION_PAGE_SIZE) break;
      }
      if (!targetIds.length) return excluded;
      const rows = await readPages((offset) => {
        let query = client.from("swipes").select("target_id,decision", { count: "exact" })
          .eq("actor_id", actorId).in("target_id", targetIds).order("target_id");
        if (includeSkipped) query = query.eq("decision", "like");
        return query.range(offset, offset + BATCH_SIZE - 1);
      }, swipeSchema);
      rows.forEach((row) => excluded.add(row.target_id));
      const matches = await readPages((offset) => client.from("matches").select("user_a,user_b", { count: "exact" })
        .or(`user_a.eq.${actorId},user_b.eq.${actorId}`).order("user_a").order("user_b")
        .range(offset, offset + BATCH_SIZE - 1), matchSchema);
      for (const match of matches) excluded.add(match.user_a === actorId ? match.user_b : match.user_a);
      return excluded;
    },
  };
}
