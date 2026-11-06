import { backendProxy } from "@/lib/discovery/backend-proxy";
export async function POST(request: Request) { return backendProxy(request, "/api/reports"); }
