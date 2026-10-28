"use client";
import { useState } from "react";
import { logoutAction } from "@/lib/auth/actions";
export function LogoutButton() {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  return <><button type="button" className="text-button" disabled={busy} onClick={async()=>{setBusy(true);try{const result=await logoutAction();if(result?.error)setError(result.error);}catch{setError("Sign out could not be completed. Please try again.");}finally{setBusy(false);}}}>{busy ? "Signing out…" : "Sign out"}</button>{error && <p role="alert">{error}</p>}</>;
}
