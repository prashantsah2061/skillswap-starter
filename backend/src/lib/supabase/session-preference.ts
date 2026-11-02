import type { CookieOptions } from "@supabase/ssr";

// Same session-only contract as the frontend; proxied refresh must not persist
// a login whose owner unchecked Remember me.
export const rememberCookie = "skillswap-remember";
export function sessionCookieOptions(options: CookieOptions, remember: boolean): CookieOptions {
  const result = { ...options, httpOnly: true, sameSite: "lax" as const,
    secure: process.env.APP_ORIGIN?.startsWith("https:") || process.env.NODE_ENV === "production" };
  if (!remember && options.maxAge !== 0) {
    delete result.maxAge;
    delete result.expires;
  }
  return result;
}
