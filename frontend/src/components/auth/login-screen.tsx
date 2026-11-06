"use client";

import { useReducedEffects } from "./motion-preferences";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import { ArrowRight, Check, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, CircleAlert } from "lucide-react";
import { Logo } from "@/components/demo/ui";
import { loginAction, googleAction } from "@/lib/auth/actions";
import { SkillAvatar } from "./skill-avatar";
import { communitySkills } from "./skill-community-data";
import { LoginAtmosphere } from "./login-atmosphere";
import "./login.css";

function LoginMascot({ covered, typing }: { covered: boolean; typing: boolean }) {
  const reduced = useReducedEffects();
  return <motion.svg className="login-mascot" viewBox="0 0 160 136" role="img" aria-label="A friendly SkillSwap character">
    <ellipse cx="80" cy="126" rx="43" ry="6" fill="#5b477d" opacity=".1" />
    <motion.g animate={reduced ? undefined : { y: [0, -3, 0] }} transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}>
      <path d="M42 80c0-24 17-39 38-39s38 15 38 39v31H42Z" fill="#a48bd1" />
      <path d="M51 75c0-23 12-39 29-39s29 16 29 39v13H51Z" fill="#f1c9a9" />
      <path d="M49 62c3-21 13-34 31-34s28 13 31 34c-8-7-16-13-21-25-8 12-22 21-41 25Z" fill="#554569" />
      <path d="M55 91c9 9 41 9 50 0v20H55Z" fill="#9479c3" />
      <motion.g animate={covered ? { opacity: 0 } : { opacity: 1 }} transition={{ duration: reduced ? 0 : .18 }}>
        <ellipse cx={typing ? 66 : 69} cy="70" rx="2.8" ry="4" fill="#393344" />
        <ellipse cx={typing ? 88 : 91} cy="70" rx="2.8" ry="4" fill="#393344" />
        <path d="M73 81q7 6 14 0" fill="none" stroke="#995f65" strokeWidth="2" strokeLinecap="round" />
      </motion.g>
      <AnimatePresence>
        {covered && <motion.g key="hands" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} transition={{ duration: reduced ? 0 : .2 }}>
          <path d="M54 78c-3-12 0-19 6-19 5 0 7 5 8 12l1 10" fill="#f1c9a9" stroke="#dcaa8f" strokeWidth="2" />
          <path d="M106 78c3-12 0-19-6-19-5 0-7 5-8 12l-1 10" fill="#f1c9a9" stroke="#dcaa8f" strokeWidth="2" />
        </motion.g>}
      </AnimatePresence>
      <motion.g className="login-mascot-wave" initial={{ rotate: 0 }} animate={reduced ? { rotate: 0 } : { rotate: [0, -25, 9, -22, 0] }} transition={{ duration: reduced ? 0 : 1.05, delay: reduced ? 0 : .25, ease: "easeInOut" }} style={{ transformOrigin: "116px 88px" }}>
        <path d="M108 89q8-9 13-21l8 4q-3 14-11 23" fill="#f1c9a9" stroke="#dcaa8f" strokeWidth="2" strokeLinejoin="round" />
      </motion.g>
    </motion.g>
  </motion.svg>;
}

function LoginContent({ oauthError, confirmationError, signInNotice }: { oauthError: boolean; confirmationError: boolean; signInNotice: boolean }) {
  const router = useRouter();
  const reduced = useReducedEffects();
  const [visible, setVisible] = useState(false);
  const [typing, setTyping] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "oauth" | "success" | "error">(oauthError || confirmationError ? "error" : "idle");
  const [error, setError] = useState(confirmationError ? "This email link could not be verified. If you already confirmed your email, sign in below. Otherwise, use the latest confirmation email." : oauthError ? "Sign-in couldn’t be completed. Please try again or sign in with email." : "");
  const destination = useRef("/dashboard");
  const busy = useRef(false);
  const mounted = useRef(true);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (status !== "success") return;
    const timeout = setTimeout(() => { router.replace(destination.current); router.refresh(); }, reduced ? 200 : 850);
    return () => clearTimeout(timeout);
  }, [status, router, reduced]);
  useEffect(() => { if (status === "error") errorRef.current?.focus(); }, [status, error]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) {
      setError("Enter a valid email address and your password."); setStatus("error"); return;
    }
    busy.current = true; setStatus("loading"); setError("");
    try {
      const result = await loginAction({ email, password, remember: true });
      if (!mounted.current) return;
      if (result.error) { setError(result.error); setStatus("error"); busy.current = false; return; }
      destination.current = "next" in result ? result.next : "/dashboard";
      setStatus("success");
    } catch {
      if (!mounted.current) return;
      setError("Sign-in is temporarily unavailable. Please try again shortly."); setStatus("error"); busy.current = false;
    }
  }
  async function googleLogin() {
    if (busy.current) return;
    busy.current = true; setStatus("oauth"); setError("");
    try {
      const result = await googleAction(true);
      if (result.error || !("url" in result) || !result.url) throw new Error("OAuth unavailable");
      window.location.assign(result.url);
    } catch {
      if (!mounted.current) return;
      busy.current = false; setStatus("error");
      setError("Google sign-in is unavailable. Please try email sign-in or try again later.");
    }
  }
  const disabled = status === "loading" || status === "oauth" || status === "success";
  return <LoginAtmosphere>
    <main className="login-layout">
      <section className="login-story" aria-label="About SkillSwap">
        <Logo href="/login" />
        <h1>Learn. Share. Connect.</h1>
        <div className="login-skill-art" aria-hidden="true">
          {[communitySkills[0], communitySkills[3], communitySkills[8]].map((skill, index) => <div key={skill.id} className={`login-skill login-skill-${index + 1}`}><SkillAvatar skill={skill} /></div>)}
          <div className="login-art-logo"><Logo href="/login" /></div>
          <span className="login-art-orbit" />
        </div>
      </section>

      <section className="login-form-section" aria-labelledby="login-title">
        <div className="login-mobile-brand"><Logo href="/login" /></div>
        <LoginMascot covered={!visible} typing={typing} />
        <div className="login-form-card">
          <h2 id="login-title">Welcome back,</h2>
          {signInNotice && <div className="login-notice" role="status"><Mail size={18} aria-hidden="true" /><p>Finish signing in with your email and password. Your email may already be confirmed, even though automatic sign-in couldn’t finish.</p></div>}
          <form onSubmit={submit} noValidate aria-busy={disabled}>
            <div className="login-field"><label htmlFor="login-email">Email</label><div className="login-input-wrap"><Mail size={18} aria-hidden="true" /><input id="login-email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required disabled={disabled} aria-describedby={error ? "login-error" : undefined} onChange={() => setTyping(true)} onFocus={() => setTyping(true)} onBlur={() => setTyping(false)} /></div></div>
            <div className="login-field"><label htmlFor="login-password">Password</label><div className="login-input-wrap"><LockKeyhole size={18} aria-hidden="true" /><input id="login-password" name="password" type={visible ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" required disabled={disabled} aria-describedby={error ? "login-error" : undefined} onChange={() => setTyping(true)} onFocus={() => setTyping(true)} onBlur={() => setTyping(false)} /><button type="button" className="login-eye" aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={() => setVisible(v => !v)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></div>
            <div className="login-options"><span /><Link href="/forgot-password">Forgot password?</Link></div>
            <AnimatePresence initial={false}>{error && <motion.div key="error" id="login-error" className="login-error" role="alert" ref={errorRef} tabIndex={-1} initial={{ opacity: 0, y: reduced ? 0 : -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><CircleAlert size={17} /><span>{error}</span></motion.div>}</AnimatePresence>
            <motion.button className="login-submit" type="submit" disabled={disabled} whileHover={disabled || reduced ? undefined : { y: -1 }} whileTap={disabled || reduced ? undefined : { scale: .99 }}><AnimatePresence mode="wait" initial={false}><motion.span key={status === "success" ? "success" : status === "loading" ? "loading" : "idle"} className="inline-flex items-center justify-center gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .12 }}>{status === "loading" ? <><LoaderCircle size={18} className="login-spinner" />Signing in…</> : status === "success" ? <><Check size={20} />You’re in! Taking you there…</> : <>Sign in <ArrowRight size={17} /></>}</motion.span></AnimatePresence></motion.button>
            <span className="sr-only" role="status">{status === "success" ? "Signed in successfully. Redirecting to dashboard." : status === "oauth" ? "Connecting to Google. Please wait." : status === "loading" ? "Signing in. Please wait." : ""}</span>
          </form>
          <div className="login-divider"><span />or<span /></div>
          <button type="button" className="login-google" onClick={googleLogin} disabled={disabled}>{status === "oauth" ? <LoaderCircle size={18} className="login-spinner" /> : <GoogleIcon />} {status === "oauth" ? "Connecting to Google…" : "Continue with Google"}</button>
          <p className="login-signup">New here? <Link href="/signup">Sign up</Link></p>
        </div>
      </section>
    </main>
  </LoginAtmosphere>;
}

function GoogleIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.61-2.42l-3.24-2.5c-.9.6-2.04.97-3.37.97-2.6 0-4.8-1.76-5.59-4.13H3.07v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.41 13.92A6 6 0 0 1 6.1 12c0-.67.11-1.32.31-1.92V7.49H3.07A10 10 0 0 0 2 12c0 1.61.38 3.14 1.07 4.51l3.34-2.59Z"/><path fill="#EA4335" d="M12 5.95c1.47 0 2.79.5 3.82 1.5l2.87-2.86A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59C7.2 7.71 9.4 5.95 12 5.95Z"/></svg>;
}

export function LoginScreen({ oauthError = false, confirmationError = false, signInNotice = false }: { oauthError?: boolean; confirmationError?: boolean; signInNotice?: boolean }) {
  return <MotionConfig reducedMotion="user"><LoginContent oauthError={oauthError} confirmationError={confirmationError} signInNotice={signInNotice} /></MotionConfig>;
}
