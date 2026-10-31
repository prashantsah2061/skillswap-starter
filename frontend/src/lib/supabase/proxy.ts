import "server-only";

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "./config";
import { rememberCookie, sessionCookieOptions } from "./session-preference";

export async function updateSession(request: NextRequest) {
  // Allow the unconfigured scaffold to run; partial configuration is an error.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return NextResponse.next({ request });
  }

  const { url, key } = getSupabaseConfig();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookieOptions: { httpOnly: true, sameSite: "lax", secure: (process.env.APP_ORIGIN?.startsWith("https:") || process.env.RENDER_EXTERNAL_URL?.startsWith("https:")) || false },
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(values, headers: Record<string, string> = {}) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        const previousResponse = response;
        response = NextResponse.next({ request });
        previousResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
        previousResponse.headers.forEach((value, name) => {
          if (name !== "set-cookie") response.headers.set(name, value);
        });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, sessionCookieOptions(options, request.cookies.get(rememberCookie)?.value !== "0")));
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  // Verify JWT claims and refresh expired sessions. Never authorize using getSession().
  // Route handlers must still verify the user and enforce resource permissions.
  await supabase.auth.getClaims();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
