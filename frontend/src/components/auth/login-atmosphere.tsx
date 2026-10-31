"use client";

import { useReducedEffects } from "./motion-preferences";

import { Fragment, useEffect, useState, type PointerEvent, type ReactNode } from "react";
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
const letterDelay = .024;
function RisingLetters({ text }: { text: string }) {
  let start = 0;
  return text.split(" ").map((word, w) => {
    const first = start;
    start += word.length + 1;
    return <Fragment key={w}>{w > 0 && " "}<span className="headline-word">{Array.from(word, (letter, i) => <motion.span key={i} initial={{ opacity: 0, y: ".55em", rotate: 7 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ type: "spring", stiffness: 320, damping: 24, delay: (first + i) * letterDelay }}>{letter}</motion.span>)}</span></Fragment>;
  });
}
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
    <div className="headline-stage" aria-hidden="true"><AnimatePresence mode="wait"><motion.div key={index} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: reduced ? 0 : -14 }} transition={{ duration: .3 }}><span className="headline-kicker">{headlines[index].label}</span><div className="headline-display">{reduced ? headlines[index].start : <RisingLetters text={headlines[index].start} />}<br />{/* A gradient clipped to text can't span individually transformed letters. */}<motion.em initial={{ opacity: 0, y: reduced ? 0 : ".4em" }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 240, damping: 20, delay: reduced ? 0 : headlines[index].start.length * letterDelay + .06 }}>{headlines[index].highlight}</motion.em></div></motion.div></AnimatePresence></div>
    <div className="headline-controls"><div className="headline-dots">{headlines.map((item,i)=><button type="button" key={item.start} aria-label={`Show message: ${item.start} ${item.highlight}`} aria-pressed={index===i} onClick={()=>{setIndex(i);setPaused(true);}} className={index===i ? "active" : ""} />)}</div><button type="button" className="motion-pause" onClick={()=>setPaused(p=>!p)} aria-label={paused ? "Play headline animation" : "Pause headline animation"}>{paused ? "Play" : "Pause"}</button></div>
  </div>;
}
