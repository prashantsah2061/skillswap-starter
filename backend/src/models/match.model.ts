import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DiscoveryError, unavailable } from "../lib/discovery/errors";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function unavailableAt(stage: string, code?: string) {
  console.error("[matches] list failed", { stage, code: code ?? null });
  return unavailable();
}

export function matchModel(client: SupabaseClient) {
  return {
    async list(actorId: string) {
      const { data: matches, error } = await client.from("matches")
        .select("id,user_a,user_b,created_at")
        .or(`user_a.eq.${actorId},user_b.eq.${actorId}`)
        .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(100);
      if (error || !matches) throw unavailableAt("matches_query", error?.code);
      const { data: hidden, error: hiddenError } = await client.rpc("get_hidden_user_ids");
      if (hiddenError || !Array.isArray(hidden)) throw unavailableAt("hidden_users_rpc", hiddenError?.code);
      const hiddenIds = new Set(hidden.map((row: { user_id: string }) => row.user_id));
      const visibleMatches = matches.filter((row) => !hiddenIds.has(row.user_a === actorId ? row.user_b : row.user_a));
      const partnerIds = [...new Set(visibleMatches.map((row) => row.user_a === actorId ? row.user_b : row.user_a))];
      if (!partnerIds.length) return [];
      const { data: partnerRows, error: partnerError } = await client.rpc(
        "get_match_partner_profiles", { p_partner_ids: partnerIds },
      );
      if (partnerError || !Array.isArray(partnerRows)) {
        throw unavailableAt("match_partner_profiles_rpc", partnerError?.code);
      }
      const partners = partnerRows as unknown as {
        user_id: string; display_name: string; bio: string; avatar_path: string | null;
      }[];
      const byId = new Map(partners.map((partner) => [partner.user_id, partner] as const));
      return visibleMatches.map((row) => {
        const partnerId = row.user_a === actorId ? row.user_b : row.user_a;
        const partner = byId.get(partnerId);
        if (!partner) throw unavailableAt("partner_profile_missing");
        const avatarUrl = partner.avatar_path
          ? client.storage.from("avatars").getPublicUrl(partner.avatar_path).data.publicUrl
          : null;
        return {
          id: row.id, created_at: row.created_at,
          partner: { id: partner.user_id, display_name: partner.display_name, bio: partner.bio, avatar_url: avatarUrl },
        };
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
