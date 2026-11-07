import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DiscoveryError, unavailable } from "../lib/discovery/errors";
import type { SessionAction } from "../lib/validators/session";

export function sessionModel(client: SupabaseClient) {
  return {
    async list(actorId: string) {
      const { data: sessions, error } = await client.from("skill_sessions")
        .select("id,match_id,created_by,proposed_by,status,scheduled_at,proposed_at,duration_minutes,notes,created_at,updated_at")
        .order("scheduled_at", { ascending: true }).order("id", { ascending: true }).limit(100);
      if (error || !sessions) throw unavailable();
      if (!sessions.length) return [];

      const matchIds = [...new Set(sessions.map(row => row.match_id))];
      const { data: matches, error: matchError } = await client.from("matches")
        .select("id,user_a,user_b").in("id", matchIds);
      if (matchError || !matches) throw unavailable();
      const partnerIds = [...new Set(matches.map(row => row.user_a === actorId ? row.user_b : row.user_a))];
      const { data: profiles, error: profileError } = await client.from("profiles")
        .select("id,display_name,bio").in("id", partnerIds);
      if (profileError || !profiles) throw unavailable();
      const matchById = new Map(matches.map(row => [row.id, row] as const));
      const profileById = new Map(profiles.map(row => [row.id, row] as const));

      return sessions.map(row => {
        const match = matchById.get(row.match_id);
        const partnerId = match && (match.user_a === actorId ? match.user_b : match.user_a);
        const partner = partnerId ? profileById.get(partnerId) : undefined;
        if (!partner) throw unavailable();
        return {
          ...row, partner, mine: row.created_by === actorId, can_accept: row.proposed_by !== actorId,
          can_complete: row.status === "confirmed" && new Date(row.scheduled_at).getTime() <= Date.now(),
        };
      });
    },

    async act(input: SessionAction) {
      const { data, error } = await client.rpc("act_on_skill_session", {
        p_action: input.action,
        p_match_id: input.action === "propose" ? input.match_id : null,
        p_session_id: input.action === "propose" ? null : input.session_id,
        p_scheduled_at: "scheduled_at" in input ? input.scheduled_at : null,
        p_duration_minutes: input.action === "propose" ? input.duration_minutes : null,
        p_notes: input.action === "propose" ? input.notes : null,
      });
      if (error) {
        if (error.code === "P0001") throw new DiscoveryError(429, "RATE_LIMITED", "You’ve reached the current session action limit. Try again later.");
        if (error.code === "22023") throw new DiscoveryError(409, "SESSION_CONFLICT", "That session cannot make this change in its current state.");
        if (error.code === "P0002") throw new DiscoveryError(404, "NOT_FOUND", "Session or match not found.");
        if (error.code === "42501") throw new DiscoveryError(403, "FORBIDDEN", "This session action is not allowed.");
        throw unavailable();
      }
      if (!Array.isArray(data) || data.length !== 1) throw unavailable();
      const { id, match_id, status, scheduled_at, proposed_at, duration_minutes, notes, created_at, updated_at } = data[0];
      return { id, match_id, status, scheduled_at, proposed_at, duration_minutes, notes, created_at, updated_at };
    },
  };
}
