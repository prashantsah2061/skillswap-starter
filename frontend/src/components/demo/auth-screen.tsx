"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Logo } from "./ui";
export function AuthScreen({ mode }: { mode: "login" | "signup" | "reset" }) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const signup = mode === "signup",
    reset = mode === "reset";
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(
      reset
        ? "Demo only: no reset email was sent. Use Try demo to explore."
        : signup
          ? "Your form is valid. This is a frontend demo; no account was created and no password was saved."
          : "This is a frontend demo. Your credentials were not checked or saved. Choose Try demo to explore.",
    );
    e.currentTarget.reset();
  }
  return (
    <>
      <Logo />
      <section className="auth-card card">
        <h1>
          {reset
            ? "Forgot password?"
            : signup
              ? "Start your skill journey"
              : "Welcome back"}
        </h1>
        <p className="subtitle">
          {reset
            ? "Let’s help you find your way back."
            : signup
              ? "Share what you know. Learn what you love."
              : "Sign in to your SkillSwap account"}
        </p>
        <form onSubmit={submit}>
          {signup && (
            <label>
              Name
              <input
                required
                name="name"
                autoComplete="name"
                maxLength={60}
                placeholder="Your name"
              />
            </label>
          )}
          <label>
            Email
            <input
              required
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@example.com"
            />
          </label>
          {!reset && (
            <label>
              Password
              <div className="password-field">
                <input
                  required
                  type={visible ? "text" : "password"}
                  minLength={8}
                  maxLength={128}
                  autoComplete={signup ? "new-password" : "current-password"}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  aria-label={visible ? "Hide password" : "Show password"}
                  aria-pressed={visible}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? "◉" : "◎"}
                </button>
              </div>
              {signup && (
                <small className="muted">
                  Use at least 8 characters. Demo passwords are never saved.
                </small>
              )}
            </label>
          )}
          {mode === "login" && (
            <Link className="forgot" href="/forgot-password">
              Forgot password?
            </Link>
          )}
          <button className="button full" type="submit">
            {reset
              ? "Preview password reset"
              : signup
                ? "Preview sign-up"
                : "Sign in"}
          </button>
        </form>
        {message && (
          <p className="feedback" role="status">
            {message}
          </p>
        )}
        <p className="auth-footer">
          {signup
            ? "Already exploring? "
            : reset
              ? "Remember your password? "
              : "New to SkillSwap? "}
          <Link href={signup || reset ? "/login" : "/signup"}>
            {signup || reset ? "Sign in" : "Create an account"}
          </Link>
        </p>
        <Link className="button lime full" href="/explore">
          Try demo <span>→</span>
        </Link>
        <small className="demo-caption">
          Frontend demo · No account needed
        </small>
      </section>
    </>
  );
}
