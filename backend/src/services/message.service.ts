import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { matchModel } from "../models/match.model";
import { messageModel } from "../models/message.model";
import { messageCursor, type MessageCursor } from "../lib/validators/message";

export async function listMessages(client: SupabaseClient, actorId: string, matchId: string, limit: number, before: MessageCursor | null) {
  await matchModel(client).requireMember(actorId, matchId);
  const page = await messageModel(client).page(matchId, limit, before);
  return {
    data: page.data.map(row => ({ ...row, mine: row.sender_id === actorId })),
    meta: { next_cursor: page.next ? messageCursor(actorId, matchId, page.next) : null },
  };
}

export async function sendMessage(client: SupabaseClient, actorId: string, matchId: string, body: string) {
  await matchModel(client).requireMember(actorId, matchId);
  const message = await messageModel(client).send(matchId, body);
  return { ...message, mine: true };
}
