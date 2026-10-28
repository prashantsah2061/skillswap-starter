"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { enrollMfaAction, verifyMfaAction } from "@/lib/auth/mfa-actions";
import { LogoutButton } from "./logout-button";
export function MfaScreen({ factors, setup = false }: { factors: { id: string; friendly_name?: string }[]; setup?: boolean }) {
  const router = useRouter();
  const [id, setId] = useState(factors[0]?.id || ""), [qr, setQr] = useState(""), [secret, setSecret] = useState("");
  const [code, setCode] = useState(""), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  return <section className="card"><h1>{setup ? "Account security" : "Verify your sign-in"}</h1><p>Use a time-based authenticator app. Administrators must use MFA before opening protected pages. Keep access to your authenticator; losing it may require administrator-assisted recovery.</p>
    {setup && <><p>Google passwords are managed by Google. To add or reset a SkillSwap password, use the verified email recovery flow. SkillSwap never merges accounts by matching emails; identity linking is handled by Supabase.</p><Link className="button secondary" href="/forgot-password">Reset or add an app password</Link></>}
    {setup && !factors.length && !qr && <button className="button" disabled={busy} onClick={async()=>{setBusy(true);try{const r=await enrollMfaAction();if(r.error)setError(r.error);else{setId(r.id!);setQr(r.qr!);setSecret(r.secret!);}}catch{setError("Please try again.");}finally{setBusy(false);}}}>Set up authenticator</button>}
    {qr && <><p>Scan this QR code with your authenticator, then verify the six-digit code.</p><Image unoptimized src={qr} width={200} height={200} alt="Authenticator enrollment QR code" /><details><summary>Enter setup key manually</summary><code>{secret}</code></details></>}
    {id && <form onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);try{const r=await verifyMfaAction(id,code);if(r.error)setError(r.error);else{setQr("");setSecret("");router.replace("/dashboard");router.refresh();}}catch{setError("Verification unavailable. Try again.");}finally{setBusy(false);}}}>
      {factors.length > 1 && <label>Authenticator<select value={id} onChange={e=>setId(e.target.value)}>{factors.map(f=><option key={f.id} value={f.id}>{f.friendly_name || "Authenticator"}</option>)}</select></label>}
      <label>Authenticator code<input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value)} disabled={busy} /></label><button className="button" disabled={busy}>{busy ? "Verifying…" : "Verify"}</button>
    </form>}
    {!setup && !factors.length && <p><Link href="/security">Set up an authenticator to continue</Link></p>}
    {error && <p role="alert" className="error-feedback">{error}</p>}<p><LogoutButton /></p>
  </section>;
}
