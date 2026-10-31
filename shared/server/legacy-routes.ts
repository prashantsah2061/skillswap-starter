// REST entry points reuse the same authenticated operations and database security.
import { GET, POST } from "./community";
export function readOperation(
  req: Request,
  op: string,
  extra: Record<string, string> = {},
) {
  const url = new URL(req.url);
  url.searchParams.set("op", op);
  Object.entries(extra).forEach(([k, v]) => url.searchParams.set(k, v));
  return GET(new Request(url, { headers: req.headers }));
}
export async function writeOperation(
  req: Request,
  op: string,
  extra: Record<string, unknown> = {},
) {
  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > 24000)
      return Response.json({ error: "Request too large" }, { status: 413 });
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    return Response.json({ error: "Invalid request" }, { status: 400 });
  return POST(
    new Request(req.url, {
      method: "POST",
      headers: req.headers,
      body: JSON.stringify({ ...body, ...extra, op }),
    }),
  );
}
