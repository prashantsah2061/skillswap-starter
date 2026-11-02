import { requirePublicApiUser } from "@/lib/api/public-auth";
import { publicResponse } from "@/lib/api/public-response";
import { publicProfileModel } from "@/models/public-profile.model";
export async function GET() {
  return publicResponse(async () => {
    const { client } = await requirePublicApiUser();
    return publicProfileModel(client).catalog();
  });
}
