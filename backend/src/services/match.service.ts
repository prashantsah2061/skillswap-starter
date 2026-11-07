import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { matchModel } from "../models/match.model";
import { swipeModel } from "../models/swipe.model";

export async function recordSwipe(client: SupabaseClient, targetId: string, decision: "like" | "pass") {
  return swipeModel(client).record(targetId, decision);
}

export const listPendingInterests = (client: SupabaseClient, actorId: string) => swipeModel(client).pending(actorId);

export const listMatches = (client: SupabaseClient, actorId: string) =>
  matchModel(client).list(actorId);
