import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DiscoveryError, unavailable } from "../lib/discovery/errors";

export function swipeModel(client: SupabaseClient) {
  return {
    async pending(actorId: string) {
      const { data: swipes, error } = await client.from("swipes").select("target_id,created_at")
        .eq("actor_id", actorId).eq("decision", "like").order("created_at", { ascending: false }).limit(100);
      if (error || !Array.isArray(swipes)) throw unavailable();
      const ids = swipes.map(row => row.target_id as string);
      if (!ids.length) return [];
      const { data: matches, error: matchError } = await client.from("matches").select("user_a,user_b")
        .or(`user_a.eq.${actorId},user_b.eq.${actorId}`);
      if (matchError || !Array.isArray(matches)) throw unavailable();
      const matched = new Set(matches.map((row: { user_a: string; user_b: string }) => row.user_a === actorId ? row.user_b : row.user_a));
      const pending = swipes.filter(row => !matched.has(row.target_id as string));
      const partnerIds = pending.map(row => row.target_id as string);
      if (!partnerIds.length) return [];
      const { data: profiles, error: profileError } = await client.from("profiles")
        .select("id,display_name,bio,meeting_preference").in("id", partnerIds)
        .eq("visible", true).eq("onboarded", true).is("suspended_at", null);
      if (profileError || !profiles) throw unavailable();
      const byId = new Map(profiles.map(profile => [profile.id, profile] as const));
      return pending.flatMap(row => {
        const partner = byId.get(row.target_id as string);
        return partner ? [{ created_at: row.created_at as string, partner }] : [];
      });
    },
    async record(targetId: string, decision: "like" | "pass") {
      const { data, error } = await client.rpc("record_swipe", {
        p_target_id: targetId,
        p_decision: decision,
      });
      if (error) {
        if (error.code === "22023") throw new DiscoveryError(400, "VALIDATION_ERROR", "Check your swipe decision.");
        if (error.code === "P0001") throw new DiscoveryError(429, "RATE_LIMITED", "You’ve reached the current swipe limit. Try again later.");
        if (error.code === "P0002") throw new DiscoveryError(404, "NOT_FOUND", "Profile not found.");
        if (error.code === "42501") throw new DiscoveryError(403, "FORBIDDEN", "This swipe is not allowed.");
        throw unavailable();
      }
      if (!Array.isArray(data) || data.length !== 1 || typeof data[0]?.matched !== "boolean") throw unavailable();
      return { matched: data[0].matched as boolean, match_id: data[0].match_id as string | null };
    },
  };
}
