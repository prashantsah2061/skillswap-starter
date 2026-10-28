"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { sessionStatusAction } from "@/lib/auth/mfa-actions";
export function SessionWatch() {
  const router = useRouter();
  useEffect(() => {
    let pending = false;
    async function check() {
      if (pending || document.visibilityState !== "visible") return;
      pending = true;
      try { const result = await sessionStatusAction(); if (!result.active) { router.replace("/login"); router.refresh(); } } catch { /* Network loss alone is not proof of signout. */ }
      finally { pending = false; }
    }
    const timer = setInterval(check, 60000);
    window.addEventListener("focus", check);
    return () => { clearInterval(timer); window.removeEventListener("focus", check); };
  }, [router]);
  return null;
}
