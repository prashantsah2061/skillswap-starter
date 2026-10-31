"use client";

import { useReducedEffects } from "./motion-preferences";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useAnimationControls, useMotionValue } from "motion/react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, Sparkles, CircleAlert, Globe2, ArrowUpRight } from "lucide-react";
import { Logo } from "@/components/demo/ui";
import { MotionProvider, Reveal, softSpring } from "@/components/ui/motion";
import { loginAction, googleAction } from "@/lib/auth/actions";
import { SkillScene } from "./skill-scene";
import { DrawnCheck, LoginMascot, SwapLoader, TiltCard, type LoginMood } from "./login-feedback";
import { AnimatedHeadline, LoginAtmosphere } from "./login-atmosphere";
import "./login.css";

function InputField({ children, onActive }: { children: ReactNode; onActive: (active: boolean) => void }) {
  const reduced = useReducedEffects();
  const [focused, setFocused] = useState(false);
  return <motion.div className="login-input-wrap" onFocus={() => { setFocused(true); onActive(true); }} onBlur={() => { setFocused(false); onActive(false); }} animate={{ scale: focused && !reduced ? 1.012 : 1 }} transition={softSpring}>{children}</motion.div>;
}

function LoginContent({ oauthError, confirmationError, signInNotice }: { oauthError: boolean; confirmationError: boolean; signInNotice: boolean }) {
  const router = useRouter();
  const reduced = useReducedEffects();
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "oauth" | "success" | "error">(oauthError || confirmationError ? "error" : "idle");
  const [error, setError] = useState(confirmationError ? "This email link could not be verified. If you already confirmed your email, sign in below. Otherwise, use the latest confirmation email." : oauthError ? "Sign-in couldn’t be completed. Please try again or sign in with email." : "");
  const destination = useRef("/dashboard");
  const [remember, setRemember] = useState(true);
  const busy = useRef(false);
  const mounted = useRef(true);
  const errorRef = useRef<HTMLDivElement>(null);
  const formMotion = useAnimationControls();
  // Lets an identical repeated validation error still give feedback.
  const [attempt, setAttempt] = useState(0);
  const [field, setField] = useState<"email" | "password" | null>(null);
  const emailLength = useMotionValue(0);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (status !== "success") return;
    const timeout = setTimeout(() => { router.replace(destination.current); router.refresh(); }, reduced ? 200 : 1300);
    return () => clearTimeout(timeout);
  }, [status, router, reduced]);
  useEffect(() => {
    if (status !== "error") return;
    errorRef.current?.focus();
    if (!reduced) void formMotion.start({ x: [0, -6, 6, -4, 4, 0], transition: { duration: .36, ease: "easeInOut" } });
  }, [status, error, attempt, reduced, formMotion]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) {
      setError("Enter a valid email address and your password."); setStatus("error"); setAttempt(a => a + 1); return;
    }
    // Disabling a focused input does not fire blur.
    setField(null);
    busy.current = true; setStatus("loading"); setError("");
    try {
      const result = await loginAction({ email, password, remember });
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
    setField(null);
    busy.current = true; setStatus("oauth"); setError("");
    try {
      const result = await googleAction(remember);
      if (result.error || !("url" in result) || !result.url) {
        busy.current = false; setStatus("error"); setError(result.error || "Google sign-in is unavailable."); return;
      }
      window.location.assign(result.url);
    } catch {
      if (!mounted.current) return;
      busy.current = false; setStatus("error");
      setError("Google sign-in is unavailable. Please try email sign-in or try again later.");
    }
  }
  const disabled = status === "loading" || status === "oauth" || status === "success";
  const mood: LoginMood = status === "success" ? "success" : status === "loading" || status === "oauth" ? "loading" : field === "password" ? (visible ? "peek" : "password") : field === "email" ? "email" : status === "error" ? "error" : "idle";
  const activity = mood === "email" || mood === "password" || mood === "peek" ? "typing" : mood;
  return (
    <LoginAtmosphere>
      <Reveal><header className="login-header flex items-center justify-between"><Logo href="/login" /></header></Reveal>
      <div className="login-grid">
        <section className="login-story">
          <Reveal delay={.12}><span className="login-eyebrow"><Sparkles size={12} /> YOUR NEXT CHAPTER STARTS HERE</span></Reveal>
          <Reveal delay={.2}><AnimatedHeadline /></Reveal>
          <Reveal delay={.28}><p className="login-intro">Your knowledge is someone else’s next breakthrough.<br className="desktop-break" /> Trade skills, spark ideas, and find your people.</p></Reveal>
          <SkillScene activity={activity} />
          <Reveal delay={.65}><div className="story-note"><span className="note-icon"><Globe2 size={17} /></span><p>A world of possibilities. A simple exchange.<br /><strong>Everyone has something worth sharing.</strong></p><span className="story-tag">LEARN ↔ TEACH</span></div></Reveal>
        </section>
        <section className="login-form-section" aria-labelledby="login-title">
          <Reveal delay={.12}><TiltCard lifted={status === "success"}><LoginMascot mood={mood} attempt={attempt} emailLength={emailLength} />
            <Reveal delay={.18}><div className="panel-heading-row"><span className="login-welcome-icon"><Sparkles size={22} strokeWidth={1.6} /></span><span className="panel-kicker">GOOD TO SEE YOU AGAIN</span></div><h2 id="login-title">Welcome back<span>.</span></h2><p className="login-subtitle">Your next great exchange is waiting.</p></Reveal>
            {signInNotice && <div className="login-notice" role="status"><Mail size={18} aria-hidden="true" /><p>Finish signing in with your email and password. Your email may already be confirmed, even though automatic sign-in couldn’t finish.</p></div>}
            <motion.form animate={formMotion} onSubmit={submit} noValidate aria-busy={disabled}>
              <Reveal delay={.25}><label htmlFor="login-email">Email address</label><InputField onActive={active => setField(active ? "email" : null)}><Mail size={18} aria-hidden="true" /><input id="login-email" onInput={event => emailLength.set(event.currentTarget.value.length)} name="email" type="email" autoComplete="email" placeholder="you@example.com" required disabled={disabled} aria-describedby={error ? "login-error" : undefined} /></InputField></Reveal>
              <Reveal delay={.32}><div className="login-label-row"><label htmlFor="login-password">Password</label></div><InputField onActive={active => setField(active ? "password" : null)}><LockKeyhole size={18} aria-hidden="true" /><input id="login-password" name="password" type={visible ? "text" : "password"} autoComplete="current-password" placeholder="Enter your app password" required disabled={disabled} aria-describedby={error ? "login-error" : undefined} /><motion.button type="button" className="login-eye" aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={() => setVisible(v => !v)} whileTap={reduced ? undefined : { scale: .85 }}><AnimatePresence mode="wait" initial={false}><motion.span key={String(visible)} initial={{ opacity: 0, rotate: -15 }} animate={{ opacity: 1, rotate: 0 }} exit={{ opacity: 0 }} transition={{ duration: .12 }}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</motion.span></AnimatePresence></motion.button></InputField></Reveal>
              <Reveal delay={.35}><div className="login-options"><label className="remember-option"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} disabled={disabled} /> Remember me</label><Link href="/forgot-password">Forgot password?</Link></div></Reveal>
              <AnimatePresence initial={false}>{error && <motion.div key="error" id="login-error" className="login-error" role="alert" ref={errorRef} tabIndex={-1} initial={{ opacity: 0, y: reduced ? 0 : -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><CircleAlert size={17} /><span>{error}</span></motion.div>}</AnimatePresence>
              <Reveal delay={.39}><motion.button className="login-submit" type="submit" disabled={disabled} animate={status === "success" && !reduced ? { scale: [1, 1.03, 1], transition: { duration: .45 } } : undefined} whileHover={disabled || reduced ? undefined : { scale: 1.015, boxShadow: "0 12px 32px #7950F265" }} whileTap={disabled || reduced ? undefined : { scale: .985 }}><AnimatePresence mode="wait" initial={false}><motion.span key={status === "success" ? "success" : status === "loading" ? "loading" : "idle"} className="inline-flex items-center justify-center gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: .12 }}>{status === "loading" ? <><SwapLoader />Signing in…</> : status === "success" ? <><motion.span initial={{ scale: reduced ? 1 : .4 }} animate={{ scale: 1 }} transition={softSpring}><DrawnCheck /></motion.span>You’re in! Taking you there…</> : <>Sign in <ArrowRight size={17} /></>}</motion.span></AnimatePresence></motion.button></Reveal>
              <span className="sr-only" role="status">{status === "success" ? "Signed in successfully. Redirecting to dashboard." : status === "oauth" ? "Connecting to Google. Please wait." : status === "loading" ? "Signing in. Please wait." : ""}</span>
            </motion.form>
            <Reveal delay={.44}><div className="login-divider"><span />or use your Google account<span /></div><button type="button" className="login-google" onClick={googleLogin} disabled={disabled}>{status === "oauth" ? <SwapLoader /> : <GoogleIcon />} {status === "oauth" ? "Connecting to Google…" : "Continue with Google"}<ArrowUpRight size={15} /></button><p className="login-demo-caption">Google manages your Google password. Email login uses a SkillSwap password.</p><p className="login-signup">New here? <Link href="/signup">Join SkillSwap <ArrowRight size={13} /></Link></p></Reveal>
          </TiltCard><p className="login-secure"><ShieldCheck size={14} /> Secure sign-in, powered by Supabase</p></Reveal>
        </section>
      </div>
      <footer className="login-footer"><span>HUMAN CONNECTION. LIMITLESS POTENTIAL.</span><span><span className="live-dot" /> Built for curious minds.</span></footer>
    </LoginAtmosphere>
  );
}

function GoogleIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.61-2.42l-3.24-2.5c-.9.6-2.04.97-3.37.97-2.6 0-4.8-1.76-5.59-4.13H3.07v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.41 13.92A6 6 0 0 1 6.1 12c0-.67.11-1.32.31-1.92V7.49H3.07A10 10 0 0 0 2 12c0 1.61.38 3.14 1.07 4.51l3.34-2.59Z"/><path fill="#EA4335" d="M12 5.95c1.47 0 2.79.5 3.82 1.5l2.87-2.86A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.93 5.49l3.34 2.59C7.2 7.71 9.4 5.95 12 5.95Z"/></svg>;
}

export function LoginScreen({ oauthError = false, confirmationError = false, signInNotice = false }: { oauthError?: boolean; confirmationError?: boolean; signInNotice?: boolean }) {
  return <MotionProvider><LoginContent oauthError={oauthError} confirmationError={confirmationError} signInNotice={signInNotice} /></MotionProvider>;
}
