"use client";

import { useSyncExternalStore } from "react";

const query = "(prefers-reduced-motion: reduce)";
function subscribe(onChange: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
function snapshot() { return window.matchMedia(query).matches; }
function serverSnapshot() { return false; }

// Unlike a mount-only preference, this also stops continuous motion if the
// operating-system setting changes while the login page is open.
export function useReducedEffects() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
