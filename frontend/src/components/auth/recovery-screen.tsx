"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { requestRecoveryAction, resetPasswordAction } from "@/lib/auth/actions";
import { Logo } from "@/components/demo/ui";

export function RecoveryScreen({ reset = false }: { reset?: boolean }) {
  const token = useRef("");
  const recoveryCode = useRef("");
  const [ready, setReady] = useState(!reset), [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false), [done, setDone] = useState(false), [invalid, setInvalid] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!reset) return;
    // Tokens in fragments avoid server request logs. PKCE query codes also
    // work in the browser that requested the email. Strip either immediately.
    let task: ReturnType<typeof setTimeout> | undefined;
    function readLink() {
      const fragment = new URLSearchParams(window.location.hash.slice(1));
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) recoveryCode.current = code;
      if (fragment.get("type") === "recovery") token.current = fragment.get("token_hash") || "";
      window.history.replaceState(null, "", window.location.pathname);
      if (task) clearTimeout(task);
      task = setTimeout(() => { setInvalid(!token.current && !recoveryCode.current); setReady(true); setError(""); setDone(false); }, 0);
    }
    readLink();
    window.addEventListener("hashchange", readLink);
    return () => { if (task) clearTimeout(task); window.removeEventListener("hashchange", readLink); };
  }, [reset]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const form = event.currentTarget, values = new FormData(form);
    setBusy(true); setError("");
    try {
      if (!reset) {
        const result = await requestRecoveryAction(String(values.get("email") || ""));
        if (result.error) setError(result.error); else { form.reset(); setDone(true); }
      } else {
        const result = await resetPasswordAction({ tokenHash: token.current, code: recoveryCode.current, password: String(values.get("password") || ""), confirmation: String(values.get("confirmation") || ""), totpCode: String(values.get("totpCode") || "") });
        if (result.error) { setError(result.error); if (result.invalid) { setInvalid(true); token.current = ""; recoveryCode.current = ""; } if (result.changed) { form.reset(); token.current = ""; recoveryCode.current = ""; setDone(true); } }
        else { form.reset(); token.current = ""; recoveryCode.current = ""; setDone(true); }
      }
    } catch { setError("This request could not be completed. Please try again."); }
    finally { setBusy(false); }
  }
  return <><Logo href="/login" /><section className="auth-card card"><h1>{reset ? "Choose a new password" : "Reset your app password"}</h1>
    <p className="subtitle">{reset ? "Use a unique passphrase you haven’t used elsewhere." : "We’ll email instructions if the address is eligible."}</p>
    {!reset && <p className="muted">Google passwords are managed by Google. Use Google’s account recovery for your Google password. This flow resets or adds a SkillSwap password only after email verification.</p>}
    {!ready ? <p role="status">Preparing recovery form…</p> : done ? <div className="feedback" role="status">{reset ? "Your password has changed. Sign in again with your new password." : "If this address is eligible, you’ll receive a recovery email. Check your inbox and spam folder. If no message arrives, try again later or use Google sign-in."}</div> : invalid ? <div className="error-feedback" role="alert">{error || "Open a valid recovery link from your latest email. Links expire and can be used only once."}</div> : <form onSubmit={submit} noValidate aria-busy={busy}>
      {!reset ? <label>Email address<input name="email" type="email" autoComplete="email" required disabled={busy} /></label> : <><label htmlFor="new-password">New password</label><div className="password-field"><input id="new-password" name="password" type={visible ? "text" : "password"} autoComplete="new-password" minLength={15} required disabled={busy} aria-describedby="new-password-help" /><button type="button" onClick={()=>setVisible(v=>!v)} aria-label={visible ? "Hide password" : "Show password"}>{visible ? <EyeOff size={20} /> : <Eye size={20} />}</button></div><small id="new-password-help" className="muted">At least 15 characters; up to 72 UTF-8 bytes (Supabase’s limit). Paste and password managers are supported.</small><label>Confirm new password<input name="confirmation" type={visible ? "text" : "password"} autoComplete="new-password" required disabled={busy} /></label><label>Authenticator code (if enabled)<input name="totpCode" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} disabled={busy} /></label></>}
      {error && <p className="error-feedback" role="alert">{error}</p>}<button className="button full" disabled={busy}>{busy && <LoaderCircle size={18} className="auth-spinner" />}{busy ? "Please wait…" : reset ? "Save new password" : "Send recovery email"}</button>
    </form>}
    {done && error && <p role="alert" className="error-feedback">{error}</p>}
    {reset && <p className="auth-footer"><Link href="/forgot-password">Request another recovery email</Link></p>}
    <p className="auth-footer"><Link href="/login">Back to sign in</Link></p>
  </section></>;
}
