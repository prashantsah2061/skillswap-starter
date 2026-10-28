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
};
export default nextConfig;
