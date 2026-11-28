import { backendProxy } from "@/lib/discovery/backend-proxy";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  if (!uuid.test(sessionId)) {
    return Response.json({ error: { code: "VALIDATION_ERROR", message: "Check the session ID." } }, {
      status: 400,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  return backendProxy(request, `/api/sessions/${sessionId}/call-token`);
}
