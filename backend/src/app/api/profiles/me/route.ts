import { requirePublicApiUser } from "@/lib/api/public-auth";
import { publicInput, publicResponse, requirePublicOrigin } from "@/lib/api/public-response";
import { publicProfileModel } from "@/models/public-profile.model";
import { publicProfileSchema } from "@/lib/validators/public-profile";

export async function GET() {
  return publicResponse(async () => {
    const { client, user } = await requirePublicApiUser();
    return publicProfileModel(client).own(user.id);
  });
}
export async function PATCH(request: Request) {
  return publicResponse(async () => {
    requirePublicOrigin(request);
    const { client, user } = await requirePublicApiUser();
    return publicProfileModel(client).saveProfile(user.id, await publicInput(request, publicProfileSchema));
  });
}
