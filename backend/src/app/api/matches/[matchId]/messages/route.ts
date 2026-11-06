import { requirePublicApiUser } from "@/lib/api/public-auth";
import { publicInput, publicResponse, requirePublicOrigin } from "@/lib/api/public-response";
import { DiscoveryError } from "@/lib/discovery/errors";
import { messageSchema, parseMessageQuery } from "@/lib/validators/message";
import { listMessages, sendMessage } from "@/services/message.service";

type Context = { params: Promise<{ matchId: string }> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function GET(request: Request, context: Context) {
  return publicResponse(async () => {
    const { matchId } = await context.params;
    if (!uuid.test(matchId)) throw new DiscoveryError(400, "VALIDATION_ERROR", "Check the match ID.");
    const { client, user } = await requirePublicApiUser();
    const query = parseMessageQuery(request.url, user.id, matchId);
    return listMessages(client, user.id, matchId, query.limit, query.before);
  });
}

export async function POST(request: Request, context: Context) {
  return publicResponse(async () => {
    requirePublicOrigin(request);
    const { matchId } = await context.params;
    if (!uuid.test(matchId)) throw new DiscoveryError(400, "VALIDATION_ERROR", "Check the match ID.");
    const { client, user } = await requirePublicApiUser();
    const { body } = await publicInput(request, messageSchema);
    return sendMessage(client, user.id, matchId, body);
  });
}
