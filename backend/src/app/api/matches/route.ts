import { requirePublicApiUser } from "@/lib/api/public-auth";
import { publicResponse } from "@/lib/api/public-response";
import { listMatches } from "@/services/match.service";

export async function GET() {
  return publicResponse(async () => {
    const { client, user } = await requirePublicApiUser();
    return listMatches(client, user.id);
  });
}
