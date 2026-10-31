"use client";
import {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import type { CommunityState } from "@/lib/community/types";
export async function community<T>(
  params: Record<string, string> | object,
  mutate = false,
): Promise<T> {
  const response = await fetch(
    "/api/community" +
      (mutate
        ? ""
        : "?" + new URLSearchParams(params as Record<string, string>)),
    mutate
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        }
      : { cache: "no-store" },
  );
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Request failed");
  return mutate ? result.data : result;
}
const Context = createContext<{
  data: CommunityState;
  refresh: () => Promise<void>;
} | null>(null);
export function DemoProvider({ children }: { children: ReactNode }) {
  const path = usePathname();
  const needsCommunity = path !== "/security" && path !== "/settings";
  const [data, setData] = useState<CommunityState | null>(null),
    [error, setError] = useState("");
  const refresh = useCallback(async () => {
    const next = await community<CommunityState>({ op: "state" });
    setData(next);
    setError("");
  }, []);
  useEffect(() => {
    if (!needsCommunity) return;
    let live = true;
    community<CommunityState>({ op: "state" })
      .then((d) => {
        if (live) setData(d);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [needsCommunity]);
  if (!needsCommunity) return children;
  if (!data)
    return (
      <div className="shell card empty" role="status">
        {error || "Loading your SkillSwap account…"}
        {error && (
          <button
            className="button"
            onClick={() => refresh().catch((e) => setError(e.message))}
          >
            Retry
          </button>
        )}
      </div>
    );
  return (
    <Context.Provider value={{ data, refresh }}>{children}</Context.Provider>
  );
}
export function useDemo() {
  const value = useContext(Context);
  if (!value) throw new Error("Community provider required");
  return value;
}
