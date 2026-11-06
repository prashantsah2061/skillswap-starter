import { requirePublicApiUser } from "@/lib/api/public-auth";
import { publicInput, publicResponse, requirePublicOrigin } from "@/lib/api/public-response";
import { recordSwipe } from "@/services/match.service";
import { swipeSchema } from "@/lib/validators/swipe";

export async function POST(request: Request) {
  return publicResponse(async () => {
    requirePublicOrigin(request);
    const { client } = await requirePublicApiUser();
    const { target_id, decision } = await publicInput(request, swipeSchema);
    return recordSwipe(client, target_id, decision);
  });
}
