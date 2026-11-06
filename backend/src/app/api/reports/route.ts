import { requirePublicApiUser } from "@/lib/api/public-auth";
import { publicInput, publicResponse, requirePublicOrigin } from "@/lib/api/public-response";
import { reportSchema } from "@/lib/validators/safety";
import { safetyModel } from "@/models/safety.model";

export async function POST(request: Request) {
  return publicResponse(async () => {
    requirePublicOrigin(request);
    const { client, user } = await requirePublicApiUser();
    return safetyModel(client).report(user.id, await publicInput(request, reportSchema));
  });
}
