import { NextResponse } from "next/server";
import { z } from "zod";
import { DiscoveryError, unavailable } from "../discovery/errors";

export const privateHeaders = { "Cache-Control": "private, no-store" };

export async function publicResponse(action: () => Promise<unknown>) {
  try { return NextResponse.json({ data: await action() }, { headers: privateHeaders }); }
  catch (error) {
    const failure = error instanceof DiscoveryError ? error : unavailable();
    return NextResponse.json({ error: { code: failure.code, message: failure.message } }, { status: failure.status, headers: privateHeaders });
  }
}

export function requirePublicOrigin(request: Request) {
  const expected = process.env.APP_ORIGIN;
  if (!expected || !URL.canParse(expected) || new URL(expected).origin !== expected) throw unavailable();
  if (request.headers.get("origin") !== expected) {
    throw new DiscoveryError(403, "FORBIDDEN", "Invalid request origin.");
  }
}

export async function publicInput<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new DiscoveryError(400, "VALIDATION_ERROR", "Send a JSON request.");
  }
  // Bound the stream itself, not only the untrusted Content-Length header.
  const reader = request.body?.getReader();
  if (!reader) throw new DiscoveryError(400, "VALIDATION_ERROR", "Check your input.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 8192) {
      await reader.cancel();
      throw new DiscoveryError(413, "REQUEST_TOO_LARGE", "Request is too large.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return schema.parse(JSON.parse(new TextDecoder().decode(bytes))); }
  catch { throw new DiscoveryError(400, "VALIDATION_ERROR", "Check your input."); }
}
