"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { community } from "./demo-provider";
import { SessionDetails } from "./sessions";
import type { Session } from "@/lib/community/types";
export function SessionRoom({ id }: { id: string }) {
  const [session, setSession] = useState<Session | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  async function load() {
    try {
      setSession(await community<Session | null>({ op: "session", id }));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let live = true;
    community<Session | null>({ op: "session", id })
      .then((s) => {
        if (live) setSession(s);
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [id]);
  return (
    <>
      <Link href="/sessions" className="breadcrumb">
        ← Back to Sessions
      </Link>
      <h1>Skill exchange session</h1>
      {error && (
        <p role="alert">
          {error}
          <button onClick={load}>Retry</button>
        </p>
      )}
      {loading ? (
        <p>Loading session…</p>
      ) : session ? (
        <SessionDetails session={session} onChange={load} />
      ) : (
        <p>Session unavailable.</p>
      )}
    </>
  );
}
