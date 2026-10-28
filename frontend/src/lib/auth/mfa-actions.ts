"use server";
import { checkActionOrigin } from "./origin";
import { verifiedSession, recentlyAuthenticated, mfaRequired } from "./session";
export async function enrollMfaAction() {
  await checkActionOrigin();
  const s = await verifiedSession();
  if (!s || !recentlyAuthenticated(s.claims)) return { error: "Sign out and sign in again before adding a verification method (within 10 minutes)." };
  const existing = await s.supabase.auth.mfa.listFactors();
  if (existing.error || existing.data.totp.some(f=>f.status === "verified") && await mfaRequired(s)) return { error: "Verify your existing second factor first." };
  const { data, error } = await s.supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "SkillSwap authenticator" });
  return error ? { error: "Could not add an authenticator. Please try again." } : { error: null, id: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}
export async function verifyMfaAction(factorId: string, code: string) {
  await checkActionOrigin();
  const s = await verifiedSession();
  if (!s || !/^[0-9]{6}$/.test(code) || typeof factorId !== "string") return { error: "Enter a valid six-digit authenticator code." };
  const factors = await s.supabase.auth.mfa.listFactors();
  if (factors.error || !factors.data.totp.some(f=>f.id === factorId)) return { error: "Verification method unavailable." };
  const { error } = await s.supabase.auth.mfa.challengeAndVerify({ factorId, code });
  return { error: error ? "Verification failed. Check your code and try again." : null };
}
export async function sessionStatusAction() {
  await checkActionOrigin();
  const s = await verifiedSession();
  return { active: !!s };
}
