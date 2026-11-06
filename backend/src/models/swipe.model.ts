import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DiscoveryError, unavailable } from "../lib/discovery/errors";

export function swipeModel(client: SupabaseClient) {
  return {
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
