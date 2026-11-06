import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DiscoveryError, unavailable } from "../lib/discovery/errors";
import type { MessageCursor } from "../lib/validators/message";

export function messageModel(client: SupabaseClient) {
  return {
    async page(matchId: string, limit: number, before: MessageCursor | null) {
      let query = client.from("messages").select("id,match_id,sender_id,body,created_at")
        .eq("match_id", matchId).order("created_at", { ascending: false })
        .order("id", { ascending: false }).limit(limit + 1);
      if (before) {
        query = query.or(`created_at.lt.${before.created_at},and(created_at.eq.${before.created_at},id.lt.${before.id})`);
      }
      const { data, error } = await query;
      if (error || !data) throw unavailable();
      const hasMore = data.length > limit;
      const descending = data.slice(0, limit);
      const chronological = descending.reverse();
      return {
        data: chronological,
        next: hasMore && chronological.length ? {
          created_at: chronological[0].created_at,
          id: chronological[0].id,
        } : null,
      };
    },

    async send(matchId: string, body: string) {
      const { data, error } = await client.rpc("send_match_message", { p_match_id: matchId, p_body: body });
      if (error) {
        if (error.code === "P0001") throw new DiscoveryError(429, "RATE_LIMITED", "You’ve reached the current message limit. Try again later.");
        if (error.code === "P0002") throw new DiscoveryError(404, "NOT_FOUND", "Conversation not found.");
        if (error.code === "42501") throw new DiscoveryError(403, "FORBIDDEN", "This message is not allowed.");
        throw unavailable();
      }
      if (!Array.isArray(data) || data.length !== 1) throw unavailable();
      return data[0];
    },
  };
}
