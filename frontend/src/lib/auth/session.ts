import "server-only";
import { createClient } from "@/lib/supabase/server";

export async function verifiedSession() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error?.name === "AuthRetryableFetchError") throw new Error("Authentication is temporarily unavailable.");
  if (error || !data.user || !data.user.email_confirmed_at) return null;
  const claims = await supabase.auth.getClaims();
  if (claims.error || !claims.data?.claims || claims.data.claims.sub !== data.user.id) return null;
  return { supabase, user: data.user, claims: claims.data.claims };
}
export async function mfaRequired(session: NonNullable<Awaited<ReturnType<typeof verifiedSession>>>) {
  const { data, error } = await session.supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return true;
  return (data.nextLevel === "aal2" || session.user.app_metadata?.role === "admin") && data.currentLevel !== "aal2";
}
export function recentlyAuthenticated(claims: { amr?: unknown }, maxAge = 600) {
  const now = Date.now() / 1000;
  return Array.isArray(claims.amr) && claims.amr.some((entry: unknown) => {
    if (!entry || typeof entry !== "object") return false;
    const { method, timestamp } = entry as { method?: string; timestamp?: number };
    return ["password", "oauth", "otp", "totp", "mfa/totp"].includes(method || "") && typeof timestamp === "number" && timestamp <= now + 30 && now - timestamp < maxAge;
  });
}
export async function requireAdmin() {
  const session = await verifiedSession();
  if (!session || session.user.app_metadata?.role !== "admin" || await mfaRequired(session)) throw new Error("Forbidden");
  return session;
}
