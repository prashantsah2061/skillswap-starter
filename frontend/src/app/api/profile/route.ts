import { NextResponse, type NextRequest } from "next/server";
import { verifiedSession, mfaRequired } from "@/lib/auth/session";
import { profileSchema } from "@/lib/auth/validation";
import { appOrigin } from "@/lib/auth/origin";
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
export async function GET() {
  const s = await verifiedSession();
  if (!s) return reply({ error: "Unauthorized" }, 401);
  if (await mfaRequired(s)) return reply({ error: "Second factor required" }, 403);
  const { data, error } = await s.supabase.from("account_profiles").select("user_id,display_name,city,bio").eq("user_id", s.user.id).single();
  return error ? reply({ error: "Profile unavailable" }, 503) : reply(data);
}
export async function PATCH(request: NextRequest) {
  if (request.headers.get("origin") !== await appOrigin()) return reply({ error: "Forbidden" }, 403);
  const s = await verifiedSession();
  if (!s) return reply({ error: "Unauthorized" }, 401);
  if (await mfaRequired(s)) return reply({ error: "Second factor required" }, 403);
  if (Number(request.headers.get("content-length")) > 8192) return reply({ error: "Request too large" }, 413);
  const body = await request.text();
  if (new TextEncoder().encode(body).length > 8192) return reply({ error: "Request too large" }, 413);
  let input: unknown;
  try { input = JSON.parse(body); } catch { return reply({ error: "Invalid profile" }, 400); }
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return reply({ error: "Invalid profile" }, 400);
  const { data, error } = await s.supabase.from("account_profiles").update(parsed.data).eq("user_id", s.user.id).select("user_id,display_name,city,bio").single();
  return error ? reply({ error: "Profile unavailable" }, 503) : reply(data);
}
