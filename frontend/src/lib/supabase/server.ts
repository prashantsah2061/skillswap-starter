import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "./config";
import { rememberCookie, sessionCookieOptions } from "./session-preference";

// Create a new client per request; never share user sessions across requests.
export async function createClient() {
  const store = await cookies();
  const { url, key } = getSupabaseConfig();

  return createServerClient(url, key, {
    cookieOptions: { httpOnly: true, sameSite: "lax", secure: (process.env.APP_ORIGIN?.startsWith("https:") || process.env.RENDER_EXTERNAL_URL?.startsWith("https:")) || false },
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) => store.set(name, value, sessionCookieOptions(options, store.get(rememberCookie)?.value !== "0")));
        } catch {
          // Server Components cannot write cookies. The proxy refreshes the
          // session before rendering and forwards cookies to the browser.
        }
      },
    },
  });
}
