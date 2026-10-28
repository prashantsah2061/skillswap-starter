import type { CookieOptions } from "@supabase/ssr";

export const rememberCookie = "skillswap-remember";

// Session-only cookies still refresh normally, but have no persistent expiry.
export function sessionCookieOptions(options: CookieOptions, remember: boolean): CookieOptions {
  if (remember || options.maxAge === 0) return options;
  const result = { ...options };
  delete result.maxAge;
  delete result.expires;
  return result;
}
