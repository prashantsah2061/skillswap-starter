import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { DiscoveryError, unavailable } from "../lib/discovery/errors";
import { discoveryUuid } from "../lib/validators/discovery";

const profile = z.object({ id: discoveryUuid, display_name: z.string(), bio: z.string() });
const skill = z.object({ id: discoveryUuid, name: z.string() });
const listing = z.object({ skill_id: discoveryUuid, direction: z.enum(["teach", "learn"]), level: z.enum(["beginner", "intermediate", "advanced"]) });

async function read<T>(query: PromiseLike<{ data: unknown; error: unknown }>, schema: z.ZodType<T>) {
  let response;
  try { response = await query; } catch { throw unavailable(); }
  if (response.error) throw unavailable();
  const parsed = schema.safeParse(response.data);
  if (!parsed.success) throw unavailable();
  return parsed.data;
}

export function publicProfileModel(client: SupabaseClient) {
  // Exact counts plus ordered range reads avoid PostgREST row-cap truncation.
  async function all<T>(query: (offset: number) => PromiseLike<{ data: unknown; error: unknown; count: number | null }>, schema: z.ZodType<T>) {
    const rows: T[] = [];
    for (;;) {
      let result;
      try { result = await query(rows.length); } catch { throw unavailable(); }
      const parsed = z.array(schema).safeParse(result.data);
      if (result.error || !parsed.success || result.count === null || result.count < 0) throw unavailable();
      rows.push(...parsed.data);
      if (rows.length >= result.count) return rows;
      if (!parsed.data.length) throw unavailable();
    }
  }
  const own = (actor: string) => read(client.from("profiles").select("id,display_name,bio").eq("id", actor).maybeSingle(), profile.nullable());
  return {
    own,
    catalog: () => all((offset) => client.from("skills").select("id,name", { count: "exact" }).order("id").range(offset, offset + 99), skill),
    listings: (actor: string) => all((offset) => client.from("user_skills")
      .select("skill_id,direction,level", { count: "exact" }).eq("user_id", actor)
      .order("skill_id").order("direction").range(offset, offset + 99), listing),
    async saveProfile(actor: string, input: { display_name: string; bio: string }) {
      const existing = await own(actor);
      // No upsert: UPDATE(id) is deliberately not granted by this schema.
      const query = existing ? client.from("profiles").update(input).eq("id", actor)
        : client.from("profiles").insert({ id: actor, ...input });
      return read(query.select("id,display_name,bio").single(), profile);
    },
    async addSkill(actor: string, input: { skill_id: string; direction: "teach" | "learn" }) {
      if (!await own(actor)) throw new DiscoveryError(409, "PROFILE_REQUIRED", "Save your public profile first.");
      const exists = await read(client.from("skills").select("id,name").eq("id", input.skill_id).maybeSingle(), skill.nullable());
      if (!exists) throw new DiscoveryError(400, "VALIDATION_ERROR", "Choose a skill from the catalog.");
      // DO NOTHING is idempotent and preserves existing self-reported level.
      // DO UPDATE would require privileges for immutable key columns.
      const { error } = await client.from("user_skills").upsert({ user_id: actor, ...input }, {
        onConflict: "user_id,skill_id,direction", ignoreDuplicates: true,
      });
      if (error) throw unavailable();
      return input;
    },
    async removeSkill(actor: string, input: { skill_id: string; direction: "teach" | "learn" }) {
      const { error } = await client.from("user_skills").delete().eq("user_id", actor)
        .eq("skill_id", input.skill_id).eq("direction", input.direction);
      if (error) throw unavailable();
      return input;
    },
  };
}
