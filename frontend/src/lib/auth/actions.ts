"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { emailSchema, registrationSchema } from "./validation";
import { checkNewPassword } from "./password-policy";
import { appOrigin, checkActionOrigin } from "./origin";
import { verifiedSession, mfaRequired } from "./session";
import { rememberCookie } from "@/lib/supabase/session-preference";

export async function loginAction(input: { email: string; password: string; remember: boolean }) {
  await checkActionOrigin();
  const failure = { error: "Unable to sign in. Check your credentials and email verification, or use Google sign-in." };
  if (!emailSchema.safeParse(input?.email).success || typeof input.password !== "string" || !input.password || input.password.length > 1024) return failure;
  try {
    (await cookies()).set(rememberCookie, input.remember ? "1" : "0", { path: "/", sameSite: "lax", secure: (await appOrigin()).startsWith("https:"), ...(input.remember ? { maxAge: 31536000 } : {}) });
    const supabase = await createClient();
    const result = await supabase.auth.signInWithPassword({ email: input.email.trim(), password: input.password });
    if (result.error || !result.data.user?.email_confirmed_at) { await supabase.auth.signOut({ scope: "local" }); return failure; }
    const session = await verifiedSession();
    if (!session) return failure;
    return { error: null, next: await mfaRequired(session) ? "/mfa" : "/dashboard" };
  } catch { return failure; }
}
export async function signupAction(input: { name: string; email: string; password: string; confirmPassword: string }) {
  await checkActionOrigin();
  const parsed = registrationSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const unsafe = await checkNewPassword(parsed.data.password);
  if (unsafe) return { error: unsafe };
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signUp({ email: parsed.data.email, password: parsed.data.password, options: { data: { display_name: parsed.data.name }, emailRedirectTo: `${await appOrigin()}/auth/callback` } });
    // Never allow autoconfirm to silently turn registration into an app session.
    await supabase.auth.signOut({ scope: "local" });
    if (error?.code === "weak_password") return { error: "Choose a stronger password that has not appeared in data breaches." };
    // Identical response for existing accounts, throttling, and ineligible emails.
    return { error: null };
  } catch { return { error: null }; }
}
export async function requestRecoveryAction(email: string) {
  await checkActionOrigin();
  if (!emailSchema.safeParse(email).success) return { error: "Enter a valid email address." };
  try {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${await appOrigin()}/reset-password` });
  } catch { /* Same public response for provider failures and unknown accounts. */ }
  return { error: null };
}
export async function resetPasswordAction(input: { tokenHash?: string; code?: string; password: string; confirmation: string; totpCode?: string }) {
  await checkActionOrigin();
  const proof = input?.tokenHash || input?.code;
  if (typeof proof !== "string" || proof.length < 10 || proof.length > 2048) return { error: "This recovery link is invalid. Request another email.", invalid: true };
  if (input.password !== input.confirmation) return { error: "Passwords don’t match." };
  const unsafe = await checkNewPassword(input.password);
  if (unsafe) return { error: unsafe };
  try {
    const supabase = await createClient();
    // The provider's expiring, single-use token is the authority, not a URL flag,
    // normal login cookie, getSession(), or user-supplied email/user ID.
    const verification = input.tokenHash
      ? await supabase.auth.verifyOtp({ type: "recovery", token_hash: input.tokenHash })
      : await supabase.auth.exchangeCodeForSession(input.code!);
    if (!input.tokenHash && (!('redirectType' in verification.data) || verification.data.redirectType !== "recovery")) {
      await supabase.auth.signOut({ scope: "local" });
      return { error: "Open a recovery link in the same browser where you requested it, or request another email.", invalid: true };
    }
    if (verification.error || !verification.data.session) return { error: "This recovery link has expired or was already used. Request another email.", invalid: true };
    const verified = await supabase.auth.getUser();
    if (verified.error || !verified.data.user) return { error: "Recovery could not be verified. Request another email.", invalid: true };
    const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    // Do not bypass an enrolled second factor with an email recovery link.
    if (assurance.error) {
      await supabase.auth.signOut({ scope: "local" });
      return { error: "Verification is unavailable. Request another recovery email.", invalid: true };
    }
    if (assurance.data?.nextLevel === "aal2" && assurance.data.currentLevel !== "aal2") {
      const factors = await supabase.auth.mfa.listFactors();
      const factor = factors.data?.totp.find(f=>f.status === "verified");
      if (!factor || !/^[0-9]{6}$/.test(input.totpCode || "")) {
        await supabase.auth.signOut({ scope: "local" });
        return { error: "An authenticator code is required for this account. Request a new link and include your code.", invalid: true };
      }
      const verifiedFactor = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: input.totpCode! });
      if (verifiedFactor.error) {
        await supabase.auth.signOut({ scope: "local" });
        return { error: "Authenticator verification failed. Request a new link and try again.", invalid: true };
      }
    }
    const { error } = await supabase.auth.updateUser({ password: input.password });
    if (error) { await supabase.auth.signOut({ scope: "local" }); return { error: "Password could not be updated. Request a new link and try again.", invalid: true }; }
    // Supabase sends the password-change notification when enabled in Dashboard.
    const { error: revokeError } = await supabase.auth.signOut({ scope: "global" });
    if (revokeError) return { error: "Password changed, but session revocation could not be confirmed. Sign out on your other devices and contact support.", changed: true };
    return { error: null, changed: true };
  } catch { return { error: "Recovery could not be completed. Request another email.", invalid: true }; }
}
export async function logoutAction() {
  await checkActionOrigin();
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) return { error: "Sign out could not be completed. Please try again." };
  (await cookies()).delete(rememberCookie);
  redirect("/login");
}

export async function googleAction(remember = true) {
  await checkActionOrigin();
  try {
    (await cookies()).set(rememberCookie, remember ? "1" : "0", { path: "/", sameSite: "lax", secure: (await appOrigin()).startsWith("https:"), ...(remember ? { maxAge: 31536000 } : {}) });
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${await appOrigin()}/auth/callback`, skipBrowserRedirect: true } });
    return error || !data.url ? { error: "Google sign-in is unavailable." } : { error: null, url: data.url };
  } catch { return { error: "Google sign-in is unavailable." }; }
}
