import { verifiedSession, mfaRequired } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await verifiedSession();
  if (!session) {
    return Response.json({ error: "Authentication required." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  if (await mfaRequired(session)) {
    return Response.json({ error: "Additional authentication required." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  // The HttpOnly refresh token stays on the server. This short-lived access
  // token is returned only so Supabase Realtime can apply the user's RLS.
  const { data, error } = await session.supabase.auth.getSession();
  if (error || !data.session || data.session.user.id !== session.user.id) {
    return Response.json({ error: "Authentication is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  return Response.json({
    data: {
      user_id: session.user.id,
      access_token: data.session.access_token,
      expires_at: data.session.expires_at ?? null,
    },
  }, { headers: { "Cache-Control": "no-store, private" } });
}
