import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DiscoveryError, unavailable } from "../lib/discovery/errors";

export function safetyModel(client: SupabaseClient) {
  return {
    async blockedProfiles() {
      const { data, error } = await client.rpc("get_my_blocked_profiles");
      if (error || !Array.isArray(data)) throw unavailable();
      return data;
    },

    async block(actorId: string, targetId: string, action: "block" | "unblock") {
      if (actorId === targetId) throw new DiscoveryError(400, "VALIDATION_ERROR", "You cannot block your own profile.");
      if (action === "block") {
        const { error } = await client.from("user_blocks").upsert(
          { blocker_id: actorId, blocked_id: targetId },
          { onConflict: "blocker_id,blocked_id", ignoreDuplicates: true },
        );
        if (error?.code === "23503") throw new DiscoveryError(404, "NOT_FOUND", "Profile not found.");
        if (error?.code === "42501") throw new DiscoveryError(403, "FORBIDDEN", "This block is not allowed.");
        if (error) throw unavailable();
      } else {
        const { error } = await client.from("user_blocks").delete()
          .eq("blocker_id", actorId).eq("blocked_id", targetId);
        if (error?.code === "42501") throw new DiscoveryError(403, "FORBIDDEN", "This unblock is not allowed.");
        if (error) throw unavailable();
      }
      return { target_id: targetId, action };
    },

    async report(actorId: string, input: { reported_id: string; match_id?: string | null; reason: string; details: string }) {
      if (actorId === input.reported_id) throw new DiscoveryError(400, "VALIDATION_ERROR", "You cannot report your own profile.");
      const { data, error } = await client.from("user_reports").insert({
        reporter_id: actorId,
        reported_id: input.reported_id,
        match_id: input.match_id ?? null,
        reason: input.reason,
        details: input.details,
      }).select("id,created_at").single();
      if (error?.code === "P0001") throw new DiscoveryError(429, "RATE_LIMITED", "You’ve reached the current report limit. Try again later.");
      if (error?.code === "42501") throw new DiscoveryError(403, "FORBIDDEN", "This report is not allowed.");
      if (error?.code === "23503") throw new DiscoveryError(404, "NOT_FOUND", "Profile or match not found.");
      if (error || !data) throw unavailable();
      return data;
    },
  };
}
