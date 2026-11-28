import { z } from "zod";
import { requirePublicApiUser } from "@/lib/api/public-auth";
import { publicInput, publicResponse, requirePublicOrigin } from "@/lib/api/public-response";
import { DiscoveryError } from "@/lib/discovery/errors";
import { requireConfirmedCallMember } from "@/services/session.service";
import { createSessionCallCredentials } from "@/services/livekit.service";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const emptyInput = z.object({}).strict();

export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  return publicResponse(async () => {
    requirePublicOrigin(request);
    const { sessionId } = await context.params;
    if (!uuid.test(sessionId)) throw new DiscoveryError(400, "VALIDATION_ERROR", "Check the session ID.");
    await publicInput(request, emptyInput);
    const { client, user } = await requirePublicApiUser();
    await requireConfirmedCallMember(client, user.id, sessionId);
    return createSessionCallCredentials(sessionId, user.id);
  });
}
