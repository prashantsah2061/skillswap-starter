import type { NextConfig } from "next";
import path from "node:path";

const workspaceRoot = path.resolve(import.meta.dirname, "..");
const nextConfig: NextConfig = {
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
      ...(process.env.APP_ORIGIN?.startsWith("https:") ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
    ] }, { source: "/reset-password", headers: [{ key: "Cache-Control", value: "private, no-store" }] }];
  },
};
export default nextConfig;
