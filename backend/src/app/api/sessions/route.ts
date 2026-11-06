import { requirePublicApiUser } from "@/lib/api/public-auth";
import { publicInput, publicResponse, requirePublicOrigin } from "@/lib/api/public-response";
import { sessionActionSchema } from "@/lib/validators/session";
import { actOnSession, listSessions } from "@/services/session.service";

export async function GET() {
  return publicResponse(async () => {
    const { client, user } = await requirePublicApiUser();
    return listSessions(client, user.id);
  });
}

export async function POST(request: Request) {
  return publicResponse(async () => {
    requirePublicOrigin(request);
    const { client } = await requirePublicApiUser();
    return actOnSession(client, await publicInput(request, sessionActionSchema));
  });
}
