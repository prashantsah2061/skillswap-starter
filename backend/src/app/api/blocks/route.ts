import { requirePublicApiUser } from "@/lib/api/public-auth";
import { publicInput, publicResponse, requirePublicOrigin } from "@/lib/api/public-response";
import { blockSchema } from "@/lib/validators/safety";
import { safetyModel } from "@/models/safety.model";

export async function POST(request: Request) {
  return publicResponse(async () => {
    requirePublicOrigin(request);
    const { client, user } = await requirePublicApiUser();
    const input = await publicInput(request, blockSchema);
    return safetyModel(client).block(user.id, input.target_id, input.action);
  });
}

export async function GET() {
  return publicResponse(async () => {
    const { client } = await requirePublicApiUser();
    return safetyModel(client).blockedProfiles();
  });
}
