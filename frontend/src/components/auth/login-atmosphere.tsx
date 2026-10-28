"use client";

import { useReducedEffects } from "./motion-preferences";

import { useEffect, useState, type PointerEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring } from "motion/react";

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

const headlines = [
  { start: "Learn something", highlight: "new.", label: "01 / DISCOVER YOUR NEXT POSSIBILITY" },
  { start: "Teach what", highlight: "you know.", label: "02 / YOUR KNOWLEDGE HAS VALUE" },
  { start: "Grow", highlight: "together.", label: "03 / BETTER WHEN WE CONNECT" },
];
export function AnimatedHeadline() {
  const reduced = useReducedEffects();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (reduced || paused) return;
    const timer = setInterval(()=>setIndex(i=>(i+1)%headlines.length), 4400);
    return () => clearInterval(timer);
  }, [reduced, paused]);
  return <div className="headline-block">
    <h1 className="sr-only">Learn Something New. Teach What You Know. Grow Together.</h1>
    <div className="headline-stage" aria-hidden="true"><AnimatePresence mode="wait" initial={false}><motion.div key={index} initial={{ opacity: 0, y: reduced ? 0 : 18, filter: reduced ? "none" : "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: reduced ? 0 : -14 }} transition={{ duration: .45 }}><span className="headline-kicker">{headlines[index].label}</span><div className="headline-display">{headlines[index].start}<br /><em>{headlines[index].highlight}</em></div></motion.div></AnimatePresence></div>
    <div className="headline-controls"><div className="headline-dots">{headlines.map((item,i)=><button type="button" key={item.start} aria-label={`Show message: ${item.start} ${item.highlight}`} aria-pressed={index===i} onClick={()=>{setIndex(i);setPaused(true);}} className={index===i ? "active" : ""} />)}</div><button type="button" className="motion-pause" onClick={()=>setPaused(p=>!p)} aria-label={paused ? "Play headline animation" : "Pause headline animation"}>{paused ? "Play" : "Pause"}</button></div>
  </div>;
}
