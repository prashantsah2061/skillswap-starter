import { requirePublicApiUser } from "@/lib/api/public-auth";
import { publicInput, publicResponse, requirePublicOrigin } from "@/lib/api/public-response";
import { publicProfileModel } from "@/models/public-profile.model";
import { publicSkillSchema } from "@/lib/validators/public-profile";
export async function GET() {
  return publicResponse(async () => {
    const { client, user } = await requirePublicApiUser();
    return publicProfileModel(client).listings(user.id);
  });
}
async function change(request: Request, remove: boolean) {
  return publicResponse(async () => {
    requirePublicOrigin(request);
    const { client, user } = await requirePublicApiUser();
    const input = await publicInput(request, publicSkillSchema);
    const model = publicProfileModel(client);
    return remove ? model.removeSkill(user.id, input) : model.addSkill(user.id, input);
  });
}
export async function POST(request: Request) { return change(request, false); }
export async function DELETE(request: Request) { return change(request, true); }
