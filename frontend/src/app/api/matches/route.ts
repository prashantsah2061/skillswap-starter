import { backendProxy } from "@/lib/discovery/backend-proxy";
export async function GET(request: Request) { return backendProxy(request, "/api/matches"); }
