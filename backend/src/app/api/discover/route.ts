import { NextResponse } from "next/server";
import { requirePublicApiUser } from "@/lib/api/public-auth";
import { discoveryModel } from "@/models/discovery.model";
import { discover } from "@/services/discovery.service";
import { parseDiscoveryQuery } from "@/lib/validators/discovery";
import { DiscoveryError } from "@/lib/discovery/errors";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const { client, user } = await requirePublicApiUser();
    const query = parseDiscoveryQuery(request.url, user.id);
    const result = await discover(discoveryModel(client), user.id, query);
    return NextResponse.json(result, { headers });
  } catch (error) {
    const failure = error instanceof DiscoveryError ? error : new DiscoveryError(500, "INTERNAL_ERROR", "Discovery could not be completed.");
    return NextResponse.json({ error: { code: failure.code, message: failure.message } }, { status: failure.status, headers });
  }
}
