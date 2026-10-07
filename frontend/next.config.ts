import type { NextConfig } from "next";
import path from "node:path";

const workspaceRoot = path.resolve(import.meta.dirname, "..");
const nextConfig: NextConfig = {
  turbopack: { root: workspaceRoot },
  outputFileTracingRoot: workspaceRoot,
};
export default nextConfig;
