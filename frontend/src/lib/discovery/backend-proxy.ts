import "server-only";
import { appOrigin } from "@/lib/auth/origin";

const privateHeaders = { "Cache-Control": "private, no-store", "Content-Type": "application/json" };
function failure(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status, headers: privateHeaders });
}

// Called only with a fixed path from a Route Handler, never a user-selected URL.
export async function backendProxy(request: Request, path: "/api/discover" | "/api/profiles/me" | "/api/skills" | "/api/user-skills" | "/api/swipes" | "/api/matches" | "/api/sessions" | "/api/blocks" | "/api/reports" | `/api/matches/${string}/messages`) {
  try {
    const configured = process.env.SKILLSWAP_BACKEND_URL;
    if (!configured) return failure(503, "DISCOVERY_UNAVAILABLE", "Discovery is temporarily unavailable.");
    const base = new URL(configured);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
    if (base.origin !== configured || (base.protocol !== "https:" && !(base.protocol === "http:" && loopback))) {
      return failure(503, "DISCOVERY_UNAVAILABLE", "Discovery is temporarily unavailable.");
    }
    const mutation = request.method !== "GET";
    if (mutation && request.headers.get("origin") !== await appOrigin()) {
      return failure(403, "FORBIDDEN", "Invalid request origin.");
    }
    const destination = new URL(path, base);
    destination.search = new URL(request.url).search;
    const headers = new Headers();
    headers.set("cookie", request.headers.get("cookie") || "");
    if (mutation) {
      headers.set("origin", request.headers.get("origin")!);
      headers.set("content-type", request.headers.get("content-type") || "");
    }
    // Limit the body before forwarding, including chunked requests.
    let body: Uint8Array | undefined;
    if (mutation) {
      const reader = request.body?.getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      if (!reader) return failure(400, "VALIDATION_ERROR", "Send a JSON request.");
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 8192) { await reader.cancel(); return failure(413, "REQUEST_TOO_LARGE", "Request is too large."); }
        chunks.push(value);
      }
      body = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
    }
    const upstream = await fetch(destination, {
      method: request.method, headers, body: body as BodyInit | undefined,
      // Render's free web services can take about a minute to wake after idle.
      cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(90000),
    });
    const responseHeaders = new Headers(privateHeaders);
    // Every cookie is a separate header, including deletion and chunk cookies.
    // Scope backend cookies to the frontend host; security/session attributes
    // are set consistently by both backend refresh helpers.
    for (const cookie of upstream.headers.getSetCookie()) {
      responseHeaders.append("set-cookie", cookie.replace(/;\s*Domain=[^;]*/gi, ""));
    }
    if (upstream.status >= 300 && upstream.status < 400) {
      return Response.json({ error: { code: "DISCOVERY_UNAVAILABLE", message: "Discovery is temporarily unavailable." } }, { status: 503, headers: responseHeaders });
    }
    // Do not pass HTML errors, arbitrary headers, or redirects to the browser.
    let result: unknown;
    try { result = await upstream.json(); }
    catch { return Response.json({ error: { code: "DISCOVERY_UNAVAILABLE", message: "Discovery is temporarily unavailable." } }, { status: 503, headers: responseHeaders }); }
    return Response.json(result, { status: upstream.status, headers: responseHeaders });
  } catch { return failure(503, "DISCOVERY_UNAVAILABLE", "Discovery is temporarily unavailable."); }
}
