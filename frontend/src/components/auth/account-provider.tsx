"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import type { AccountProfile } from "@/lib/profile/server";
const Context = createContext<{ profile: AccountProfile | null; name: string; setProfile: (profile: AccountProfile) => void } | null>(null);
export function AccountProvider({ profile, fallback, children }: { profile: AccountProfile | null; fallback: string; children: ReactNode }) {
  const [saved, setSaved] = useState(profile);
  return <Context.Provider value={{ profile: saved, name: saved?.display_name || fallback, setProfile: setSaved }}>{children}</Context.Provider>;
}
export function useAccount() {
  const context = useContext(Context);
  if (!context) throw new Error("AccountProvider required");
  return context;
}
