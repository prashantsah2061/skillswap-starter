import { backendProxy } from "@/lib/discovery/backend-proxy";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type Context = { params: Promise<{ matchId: string }> };
async function forward(request: Request, context: Context) {
  const { matchId } = await context.params;
  if (!uuid.test(matchId)) return Response.json({ error: { code: "VALIDATION_ERROR", message: "Check the match ID." } }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
  return backendProxy(request, `/api/matches/${matchId}/messages`);
}
export async function GET(request: Request, context: Context) { return forward(request, context); }
export async function POST(request: Request, context: Context) { return forward(request, context); }
