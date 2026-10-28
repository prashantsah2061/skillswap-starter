"use client";

import { createBrowserClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";
import { getSupabaseConfig } from "./config";
import { rememberCookie, sessionCookieOptions } from "./session-preference";

export function setRememberPreference(remember: boolean) {
  document.cookie = serializeCookieHeader(rememberCookie, remember ? "1" : "0", {
    path: "/", sameSite: "lax", secure: window.location.protocol === "https:",
    ...(remember ? { maxAge: 60 * 60 * 24 * 365 } : {}),
  });
}

// Authentication now uses server actions and HttpOnly cookies. This browser
// helper is reserved for anonymous/public queries, not authenticated sessions.
export function createClient() {
  const { url, key } = getSupabaseConfig();
  return createBrowserClient(url, key, {
    cookieOptions: { sameSite: "lax", secure: typeof window !== "undefined" && window.location.protocol === "https:" },
    cookies: {
      getAll() {
        return parseCookieHeader(document.cookie).map(({ name, value }) => ({ name, value: value ?? "" }));
      },
      setAll(values) {
        const remember = !parseCookieHeader(document.cookie).some(c => c.name === rememberCookie && c.value === "0");
        values.forEach(({ name, value, options }) => {
          document.cookie = serializeCookieHeader(name, value, sessionCookieOptions(options, remember));
        });
      },
    },
  });
}
