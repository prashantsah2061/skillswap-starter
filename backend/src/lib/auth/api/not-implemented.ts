import { NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/auth/require-user";
export async function notImplemented(feature: string) {
  if (!feature.includes("/api/auth/")) {
    try {
      const { user, supabase } = await getVerifiedUser();
      if (!user?.email_confirmed_at) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (error || !data || (data.nextLevel === "aal2" || user.app_metadata?.role === "admin") && data.currentLevel !== "aal2") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  }
  return NextResponse.json({ error: { code: "NOT_IMPLEMENTED", message: `${feature} is not implemented.` } }, { status: 501, headers: { "Cache-Control": "no-store" } });
}
