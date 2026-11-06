import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DiscoveryError, unavailable } from "../lib/discovery/errors";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function matchModel(client: SupabaseClient) {
  return {
    async list(actorId: string) {
      const { data: matches, error } = await client.from("matches")
        .select("id,user_a,user_b,created_at")
        .or(`user_a.eq.${actorId},user_b.eq.${actorId}`)
        .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(100);
      if (error || !matches) throw unavailable();
      const { data: hidden, error: hiddenError } = await client.rpc("get_hidden_user_ids");
      if (hiddenError || !Array.isArray(hidden)) throw unavailable();
      const hiddenIds = new Set(hidden.map((row: { user_id: string }) => row.user_id));
      const visibleMatches = matches.filter((row) => !hiddenIds.has(row.user_a === actorId ? row.user_b : row.user_a));
      const partnerIds = [...new Set(visibleMatches.map((row) => row.user_a === actorId ? row.user_b : row.user_a))];
      if (!partnerIds.length) return [];
      const { data: profiles, error: profileError } = await client.from("profiles")
        .select("id,display_name,bio").in("id", partnerIds);
      if (profileError || !profiles) throw unavailable();
      const byId = new Map(profiles.map((profile) => [profile.id, profile] as const));
      return visibleMatches.map((row) => {
        const partnerId = row.user_a === actorId ? row.user_b : row.user_a;
        const partner = byId.get(partnerId);
        if (!partner) throw unavailable();
        return { id: row.id, created_at: row.created_at, partner };
      });
    },

    async requireMember(actorId: string, matchId: string) {
      if (!uuid.test(matchId)) throw new DiscoveryError(400, "VALIDATION_ERROR", "Check the match ID.");
      const { data, error } = await client.from("matches").select("id,user_a,user_b")
        .eq("id", matchId).maybeSingle();
      if (error) throw unavailable();
      if (!data || (data.user_a !== actorId && data.user_b !== actorId)) {
        throw new DiscoveryError(404, "NOT_FOUND", "Conversation not found.");
      }
      return data;
    },
  };
}
