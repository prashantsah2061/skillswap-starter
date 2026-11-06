"use client";

import { useReducedEffects } from "./motion-preferences";

import { type PointerEvent, type ReactNode } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";

export function LoginAtmosphere({ children }: { children: ReactNode }) {
  const reduced = useReducedEffects();
  const rawX = useMotionValue(0), rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 35, damping: 25 }), y = useSpring(rawY, { stiffness: 35, damping: 25 });
  function follow(event: PointerEvent<HTMLDivElement>) {
    if (reduced || event.pointerType !== "mouse" || !window.matchMedia("(min-width: 900px)").matches) return;
    rawX.set((event.clientX/window.innerWidth-.5)*35); rawY.set((event.clientY/window.innerHeight-.5)*25);
  }
  return <div className="login-page" onPointerMove={follow} onPointerLeave={() => { rawX.set(0); rawY.set(0); }}>
    <motion.div className="login-atmosphere" aria-hidden="true" style={reduced ? undefined : { x, y }}><div className="login-grid-texture" /><div className="login-orb orb-blue" /><div className="login-orb orb-purple" /><div className="login-orb orb-cyan" />{Array.from({ length: 16 }, (_,i)=><span key={i} className="ambient-particle" style={{ left: `${(i*31+7)%100}%`, top: `${(i*17+11)%100}%`, animationDelay: `${-i*1.8}s`, animationDuration: `${9+i%5*2}s` }} />)}</motion.div>
    {children}
  </div>;
}
