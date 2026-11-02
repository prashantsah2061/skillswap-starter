import { backendProxy } from "@/lib/discovery/backend-proxy";
export async function GET(request: Request) { return backendProxy(request, "/api/profiles/me"); }
export async function PATCH(request: Request) { return backendProxy(request, "/api/profiles/me"); }
