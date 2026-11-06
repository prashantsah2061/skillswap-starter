import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sessionModel } from "../models/session.model";
import type { SessionAction } from "../lib/validators/session";

export const listSessions = (client: SupabaseClient, actorId: string) => sessionModel(client).list(actorId);
export async function actOnSession(client: SupabaseClient, input: SessionAction) {
  return sessionModel(client).act(input);
}
