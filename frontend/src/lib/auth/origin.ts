import "server-only";
import { headers } from "next/headers";

const loopback = (hostname: string) => hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";

export async function appOrigin() {
  const configured = process.env.APP_ORIGIN;
  if (process.env.NODE_ENV === "production" && !configured) throw new Error("APP_ORIGIN is required for authentication redirects.");
  const value = configured || "http://localhost:3000";
  const url = new URL(value);
  if (url.origin !== value || (url.protocol !== "https:" && !loopback(url.hostname))) throw new Error("Invalid APP_ORIGIN.");

  // next dev can choose another port when 3000 is occupied. Allow only a
  // loopback request whose Origin matches its actual Host; never trust an
  // arbitrary Origin or forwarded host as a redirect destination.
  if (process.env.NODE_ENV === "development" && loopback(url.hostname)) {
    const h = await headers();
    const host = h.get("host");
    if (host) {
      try {
        const local = new URL(`${url.protocol}//${host}`);
        if (loopback(local.hostname) && (!h.get("origin") || h.get("origin") === local.origin)) return local.origin;
      } catch { /* Keep the configured, validated origin. */ }
    }
  }
  return url.origin;
}
export async function checkActionOrigin() {
  const h = await headers();
  const expected = await appOrigin();
  // Next also enforces Origin/Host matching before invoking Server Actions.
  if (h.get("origin") !== expected) throw new Error("Invalid request origin.");
}
