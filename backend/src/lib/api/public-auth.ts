import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { DiscoveryError, unavailable } from "../discovery/errors";

function authFailure(error: { status?: number; name?: string; code?: string }): never {
  if (error.status === 429) throw new DiscoveryError(429, "RATE_LIMITED", "Try again later.");
  const invalidSession = ["bad_jwt", "session_not_found", "session_expired", "refresh_token_not_found", "refresh_token_already_used", "user_not_found", "user_banned", "email_not_confirmed"];
  if (error.name === "AuthSessionMissingError" || error.status === 401 || error.status === 403 || invalidSession.includes(error.code ?? "")) {
    throw new DiscoveryError(401, "UNAUTHORIZED", "Sign in to continue.");
  }
  throw unavailable();
}

export async function requirePublicApiUser() {
  try { getSupabaseConfig(); } catch { throw unavailable(); }
  const client = await createClient().catch(() => { throw unavailable(); });
  const { data, error } = await client.auth.getUser().catch(() => { throw unavailable(); });
  if (error) authFailure(error);
  const user = data.user;
  if (!user?.email_confirmed_at) throw new DiscoveryError(401, "UNAUTHORIZED", "Sign in to continue.");
  const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel().catch(() => { throw unavailable(); });
  if (assurance.error) authFailure(assurance.error);
  if (!assurance.data) throw unavailable();
  if ((assurance.data.nextLevel === "aal2" || user.app_metadata?.role === "admin") && assurance.data.currentLevel !== "aal2") {
    throw new DiscoveryError(403, "MFA_REQUIRED", "Complete second-factor verification.");
  }
  return { client, user };
}
