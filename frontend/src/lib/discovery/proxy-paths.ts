// Shared by the frontend request proxy and fixed Route Handlers. These API
// requests refresh only at the backend, avoiding competing refresh-token uses.
export const discoveryProxyPaths = ["/api/discover", "/api/public-profile", "/api/skills", "/api/user-skills"];
