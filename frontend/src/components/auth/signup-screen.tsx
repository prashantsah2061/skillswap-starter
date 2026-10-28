"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, EyeOff, LoaderCircle, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/demo/ui";
import { signupAction } from "@/lib/auth/actions";

export function SignupScreen() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "confirmation" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const busy = useRef(false);
  const mounted = useRef(true);
  const feedback = useRef<HTMLDivElement>(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => { if (status === "error" || status === "confirmation") feedback.current?.focus(); }, [status, error]);
  useEffect(() => {
    if (status !== "success") return;
    const timer = setTimeout(() => { router.replace("/dashboard"); router.refresh(); }, 700);
    return () => clearTimeout(timer);
  }, [status, router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const name = String(values.get("name") || "").trim();
    const email = String(values.get("email") || "").trim();
    const password = String(values.get("password") || "");
    const confirmation = String(values.get("confirmPassword") || "");
    function fail(message: string) { setError(message); setStatus("error"); }
    if (!name || name.length > 80) { fail("Enter your name (up to 80 characters)."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fail("Enter a valid email address."); return;
    }
    if ([...password].length < 15 || new TextEncoder().encode(password).length > 72) {
      fail("Use at least 15 characters and no more than 72 UTF-8 bytes."); return;
    }
    if (password !== confirmation) { fail("Your passwords don’t match."); return; }
    busy.current = true; setStatus("loading"); setError("");
    try {
      const result = await signupAction({ name, email, password, confirmPassword: confirmation });
      if (!mounted.current) return;
      if (result.error) { fail(result.error); busy.current = false; return; }
      // Clear password controls immediately; never persist credentials in app state/storage.
      form.reset(); setVisible(false);
      setStatus("confirmation");
    } catch {
      if (!mounted.current) return;
      fail("Account creation is temporarily unavailable. Please try again shortly.");
      busy.current = false;
    }
  }
  const disabled = status === "loading" || status === "success";
  const finished = status === "confirmation" || status === "success";
  return <>
    <Logo href="/login" />
    <section className="auth-card card" aria-labelledby="signup-title">
      <h1 id="signup-title">Start your skill journey</h1>
      <p className="subtitle">Share what you know. Learn what you love.</p>
      {finished ? <div className="feedback signup-success" role="status" tabIndex={-1} ref={feedback}>
        <CheckCircle2 size={25} aria-hidden="true" />
        <h2>{status === "success" ? "Your account is ready" : "Check your email"}</h2>
        <p>{status === "success" ? "Taking you to your dashboard…" : "If this address is eligible for registration, you’ll receive a confirmation email. Follow its link to finish creating your account. Already registered? Sign in below."}</p>
      </div> : <form onSubmit={submit} noValidate aria-busy={disabled}>
        <label htmlFor="signup-name">Your name</label>
        <input id="signup-name" name="name" autoComplete="name" placeholder="Your name" required maxLength={80} disabled={disabled} aria-describedby="name-help" />
        <small id="name-help" className="muted">This is your display name. You can change it in your profile.</small>
        <label htmlFor="signup-email">Email address</label>
        <input id="signup-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required disabled={disabled} />
        <label htmlFor="signup-password">Password</label>
        <div className="password-field">
          <input id="signup-password" name="password" type={visible ? "text" : "password"} autoComplete="new-password" placeholder="Create a password" required minLength={15} disabled={disabled} aria-describedby="password-help" />
          <button type="button" onClick={() => setVisible(v=>!v)} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible}>{visible ? <EyeOff size={20} /> : <Eye size={20} />}</button>
        </div>
        <small id="password-help" className="muted">Use at least 15 characters, up to 72 UTF-8 bytes. Known breached passwords are blocked. Supabase manages your password.</small>
        <label htmlFor="signup-confirm">Confirm password</label>
        <input id="signup-confirm" name="confirmPassword" type={visible ? "text" : "password"} autoComplete="new-password" placeholder="Re-enter your password" required disabled={disabled} />
        {error && <div className="error-feedback" role="alert" tabIndex={-1} ref={feedback}>{error}</div>}
        <button className="button full" type="submit" disabled={disabled}>{status === "loading" && <LoaderCircle className="auth-spinner" size={18} aria-hidden="true" />}{status === "loading" ? "Creating account…" : "Create account"}</button>
        <p className="auth-security-note"><ShieldCheck size={14} aria-hidden="true" /> Your password stays with Supabase Auth.</p>
      </form>}
      <p className="auth-footer">Already have an account? <Link href="/login">Sign in</Link></p>
    </section>
  </>;
}
