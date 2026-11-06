// Shared by the frontend request proxy and fixed Route Handlers. These API
// requests refresh only at the backend, avoiding competing refresh-token uses.
export const discoveryProxyPaths = [
  "/api/discover", "/api/public-profile", "/api/skills", "/api/user-skills",
  "/api/swipes", "/api/matches", "/api/sessions", "/api/blocks", "/api/reports",
];
export const isBackendProxyPath = (path: string) =>
  discoveryProxyPaths.includes(path) || /^\/api\/matches\/[0-9a-f-]{36}\/messages$/.test(path);
