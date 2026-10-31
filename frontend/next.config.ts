import type { NextConfig } from "next";
import path from "node:path";

const workspaceRoot = path.resolve(import.meta.dirname, "..");
const trustedActionHosts = [process.env.APP_ORIGIN, process.env.RENDER_EXTERNAL_URL].flatMap(value => {
  if (!value) return [];
  try {
    const normalized = value.trim().replace(/\/+$/, "");
    const url = new URL(normalized);
    if (url.origin !== normalized || (url.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) return [];
    return [url.host];
  } catch { return []; }
});
const nextConfig: NextConfig = {
  // Exact deployment hosts only; permits Render's reverse proxy without
  // weakening the application-level Origin check or adding wildcard domains.
  experimental: { serverActions: { allowedOrigins: [...new Set(trustedActionHosts)] } },
  // Next.js development tracing otherwise prints action arguments, including
  // passwords and OTPs. Auth callback query strings must not be logged either.
  logging: {
    serverFunctions: false,
    incomingRequests: { ignore: [/^\/auth\//, /^\/reset-password/] },
  },
  turbopack: { root: workspaceRoot },
  outputFileTracingRoot: workspaceRoot,
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      ...((process.env.APP_ORIGIN?.startsWith("https:") || process.env.RENDER_EXTERNAL_URL?.startsWith("https:")) ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
    ] }, { source: "/reset-password", headers: [{ key: "Cache-Control", value: "private, no-store" }] }];
  },
};
export default nextConfig;
