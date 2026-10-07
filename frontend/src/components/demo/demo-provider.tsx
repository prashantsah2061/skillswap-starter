"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { z } from "zod";
import { initialDemo, type DemoState } from "@/lib/frontend-data";
// Validate browser storage before using it; old or malformed data falls back to fixtures.
const profileSchema = z.object({
  name: z.string(),
  city: z.string(),
  bio: z.string(),
  photo: z.enum(["alex", "maya", "jordan"]),
  teaches: z.array(z.string()),
  learns: z.array(z.string()),
});
const stateSchema = z.object({
  profile: profileSchema,
  matches: z.array(z.string()),
  messages: z.record(
    z.string(),
    z.array(
      z.object({
        id: z.string(),
        text: z.string(),
        mine: z.boolean(),
        time: z.string(),
      }),
    ),
  ),
  sessions: z.array(
    z.object({
      id: z.string(),
      partner: z.string(),
      learn: z.string(),
      teach: z.string(),
      date: z.string(),
      time: z.string(),
      past: z.boolean(),
    }),
  ),
});
const Context = createContext<{
  data: DemoState;
  update: (fn: (prev: DemoState) => DemoState) => void;
  storageWarning: boolean;
} | null>(null);
export function DemoProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState(initialDemo);
  const [ready, setReady] = useState(false);
  const [storageWarning, setWarning] = useState(false);
  useEffect(() => {
    // The first client render matches the server. Restore preferences after hydration.
    const task = setTimeout(() => {
      try {
        const saved = localStorage.getItem("skillswap-demo-v1");
        if (saved) {
          const parsed = stateSchema.safeParse(JSON.parse(saved));
          if (parsed.success) setData(parsed.data);
        }
      } catch {
        setWarning(true);
      }
      setReady(true);
    }, 0);
    return () => clearTimeout(task);
  }, []);
  useEffect(() => {
    if (!ready) return;
    let warning: ReturnType<typeof setTimeout> | undefined;
    try {
      localStorage.setItem("skillswap-demo-v1", JSON.stringify(data));
    } catch {
      warning = setTimeout(() => setWarning(true), 0);
    }
    return () => {
      if (warning) clearTimeout(warning);
    };
  }, [data, ready]);
  return (
    <Context.Provider value={{ data, update: setData, storageWarning }}>
      {children}
    </Context.Provider>
  );
}
export function useDemo() {
  const value = useContext(Context);
  if (!value) throw new Error("DemoProvider is required");
  return value;
}
