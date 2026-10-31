import "server-only";
import { headers } from "next/headers";

const loopback = (hostname: string) => hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
export class AuthOriginError extends Error {
  constructor() { super("Authentication origin configuration is invalid."); this.name = "AuthOriginError"; }
}
function normalizeOrigin(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  const url = new URL(trimmed);
  if (url.origin !== trimmed || (url.protocol !== "https:" && !loopback(url.hostname))) throw new AuthOriginError();
  return url.origin;
}
export async function appOrigin() {
  const production = process.env.NODE_ENV === "production";
  const render = process.env.RENDER_EXTERNAL_URL;
  const origins: string[] = [];
  for (const raw of [process.env.APP_ORIGIN, render]) {
    if (!raw) continue;
    try {
      const origin = normalizeOrigin(raw);
      // Ignore a copied localhost setting on Render; its platform URL is trusted.
      if (production && render && loopback(new URL(origin).hostname)) continue;
      if (!origins.includes(origin)) origins.push(origin);
    } catch { if (!render) throw new AuthOriginError(); }
  }
  if (!origins.length) {
    if (production) throw new AuthOriginError();
    origins.push("http://localhost:3000");
  }
  const h = await headers();
  const requestOrigin = h.get("origin");
  // Every candidate comes from operator/platform configuration, never from an
  // untrusted Host/Origin header. Explicit custom domains and Render both work.
  if (requestOrigin && origins.includes(requestOrigin)) return requestOrigin;
  for (const host of [h.get("host"), h.get("x-forwarded-host")]) {
    const match = origins.find(origin => new URL(origin).host === host);
    if (match) return match;
  }
  if (process.env.NODE_ENV === "development" && loopback(new URL(origins[0]).hostname)) {
    const host = h.get("host");
    if (host) {
      try {
        const local = new URL(`${new URL(origins[0]).protocol}//${host}`);
        if (loopback(local.hostname) && (!requestOrigin || requestOrigin === local.origin)) return local.origin;
      } catch { /* Fall back to an explicitly configured origin. */ }
    }
  }
  return origins[0];
}
export async function checkActionOrigin() {
  const h = await headers();
  if (h.get("origin") !== await appOrigin()) throw new AuthOriginError();
}
