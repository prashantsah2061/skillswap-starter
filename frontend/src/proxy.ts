import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { NextResponse } from "next/server";
import { discoveryProxyPaths } from "@/lib/discovery/proxy-paths";
// Next.js 16 convention. Refreshes cookies; does NOT replace endpoint authorization.
export async function proxy(request: NextRequest) {
  if (discoveryProxyPaths.includes(request.nextUrl.pathname)) return NextResponse.next();
  return updateSession(request);
}
export const config={matcher:["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]};
