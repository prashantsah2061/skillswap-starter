import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { unavailable } from "@/lib/discovery/errors";
// Next.js 16 convention. Refreshes cookies; does NOT replace endpoint authorization.
export async function proxy(request: NextRequest) {
  try { return await updateSession(request); }
  catch (error) {
    // A partial Supabase configuration or refresh outage must preserve the public APIs'
    // operational-error contract even when it occurs before the route executes.
    if (!["/api/discover", "/api/profiles/me", "/api/skills", "/api/user-skills", "/api/swipes", "/api/matches", "/api/sessions", "/api/blocks", "/api/reports"].includes(request.nextUrl.pathname)
      && !/^\/api\/matches\/[0-9a-f-]{36}\/messages$/.test(request.nextUrl.pathname)) throw error;
    const failure = unavailable();
    return NextResponse.json({ error: { code: failure.code, message: failure.message } }, {
      status: failure.status, headers: { "Cache-Control": "private, no-store" },
    });
  }
}
export const config={matcher:["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]};
