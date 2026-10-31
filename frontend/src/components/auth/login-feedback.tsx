"use client";

import { useEffect, useRef, type PointerEvent, type ReactNode } from "react";
import { animate, motion, useAnimationControls, useMotionTemplate, useMotionValue, useSpring, type MotionValue } from "motion/react";
import { useReducedEffects } from "./motion-preferences";

export type LoginMood = "idle" | "email" | "password" | "peek" | "loading" | "success" | "error";

const mouths: Record<LoginMood, string> = {
  idle: "M52 54 Q60 60 68 54",
  email: "M53 55 Q60 59 67 55",
  password: "M55 56 Q60 57 65 56",
  peek: "M55 55 Q60 59 65 55",
  loading: "M55 56 Q60 56 65 56",
  success: "M49 52 Q60 68 71 52",
  error: "M52 58 Q60 51 68 58",
};
const rest = { left: { x: 30, y: 72 }, right: { x: 90, y: 72 } };
const eyes = { left: { x: 50, y: 40 }, right: { x: 70, y: 40 } };
const raised = { left: { x: 22, y: 20 }, right: { x: 98, y: 20 } };
const hands: Record<LoginMood, typeof rest> = {
  idle: rest,
  email: rest,
  loading: rest,
  error: rest,
  password: { left: eyes.left, right: eyes.right },
  peek: { left: eyes.left, right: { x: 84, y: 58 } },
  success: raised,
};
const skin = "#f2c7a5", shirt = "#7950F2";

function Arm({ shoulder, hand, reduced }: { shoulder: number; hand: { x: number; y: number }; reduced: boolean }) {
  const transition = reduced ? { duration: 0 } : { type: "spring" as const, stiffness: 260, damping: 22 };
  return <>
    <motion.line x1={shoulder} y1="92" stroke={shirt} strokeWidth="9" strokeLinecap="round" initial={false} animate={{ x2: hand.x, y2: hand.y }} transition={transition} />
    <motion.circle r="7.5" fill={skin} initial={false} animate={{ cx: hand.x, cy: hand.y }} transition={transition} />
  </>;
}

// The character only ever learns which field has focus and the email's length,
// never the characters typed, and nothing about the password's contents.
export function LoginMascot({ mood, attempt, emailLength }: { mood: LoginMood; attempt: number; emailLength: MotionValue<number> }) {
  const reduced = useReducedEffects();
  const svg = useRef<SVGSVGElement>(null);
  const head = useAnimationControls();
  const lookX = useMotionValue(0), lookY = useMotionValue(0);
  const pupilX = useSpring(lookX, { stiffness: 300, damping: 26 }), pupilY = useSpring(lookY, { stiffness: 300, damping: 26 });
  useEffect(() => {
    lookX.set(0); lookY.set(mood === "email" || mood === "error" ? 2 : 0);
    if (reduced) return;
    if (mood === "email") {
      const follow = (length: number) => lookX.set(Math.min(length / 26, 1) * 5.4 - 2.7);
      follow(emailLength.get());
      return emailLength.on("change", follow);
    }
    if (mood === "loading") {
      const search = animate(lookX, [-2.7, 2.7], { duration: .55, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" });
      return () => search.stop();
    }
    if (mood === "idle") {
      const watch = (event: globalThis.PointerEvent) => {
        const box = svg.current?.getBoundingClientRect();
        if (!box || event.pointerType !== "mouse") return;
        lookX.set(Math.max(-1, Math.min(1, (event.clientX - box.x - box.width / 2) / 260)) * 2.7);
        lookY.set(Math.max(-1, Math.min(1, (event.clientY - box.y - box.height / 2) / 260)) * 2.4);
      };
      window.addEventListener("pointermove", watch);
      return () => window.removeEventListener("pointermove", watch);
    }
  }, [mood, reduced, emailLength, lookX, lookY]);
  useEffect(() => {
    if (mood === "error" && !reduced) void head.start({ rotate: [0, -9, 9, -6, 6, 0], transition: { duration: .5 } });
  }, [mood, attempt, reduced, head]);
  const happy = mood === "success";
  return <svg ref={svg} className="login-mascot" viewBox="0 0 120 78" aria-hidden="true" focusable="false">
    <motion.g initial={{ y: reduced ? 0 : 74 }} animate={{ y: 0 }} transition={{ type: "spring", stiffness: 170, damping: 17, delay: reduced ? 0 : .7 }}>
      <motion.g animate={happy && !reduced ? { y: [0, -7, 0, -4, 0] } : { y: 0 }} transition={{ duration: .75 }}>
        <path d="M30 80 Q33 61 60 61 Q87 61 90 80Z" fill={shirt} />
        <rect x="54" y="54" width="12" height="11" rx="4" fill={skin} />
        <motion.g animate={head}>
          <ellipse cx="60" cy="38" rx="22" ry="24" fill={skin} />
          <path d="M37 40 Q33 11 60 12 Q87 11 83 40 Q79 24 65 22 Q52 31 37 40Z" fill="#3b2f63" />
          <motion.ellipse cx="46" cy="49" rx="5" ry="3" fill="#e8958f" initial={false} animate={{ opacity: happy ? .75 : .25 }} />
          <motion.ellipse cx="74" cy="49" rx="5" ry="3" fill="#e8958f" initial={false} animate={{ opacity: happy ? .75 : .25 }} />
          <motion.g initial={false} animate={{ opacity: happy ? 0 : 1 }} transition={{ duration: .1 }}>
            <motion.g animate={reduced || happy ? { scaleY: 1 } : { scaleY: [1, 1, .1, 1] }} transition={reduced || happy ? { duration: 0 } : { duration: .26, times: [0, .4, .6, 1], repeat: Infinity, repeatDelay: 3.4 }}>
              {[eyes.left, eyes.right].map(eye => <g key={eye.x}><circle cx={eye.x} cy={eye.y} r="6" fill="#fff" /><motion.circle cx={eye.x} cy={eye.y} r="3" fill="#2c2840" style={{ x: pupilX, y: pupilY }} /></g>)}
            </motion.g>
          </motion.g>
          <motion.path d="M44 42 Q50 34 56 42 M64 42 Q70 34 76 42" fill="none" stroke="#2c2840" strokeWidth="2.6" strokeLinecap="round" initial={false} animate={{ opacity: happy ? 1 : 0 }} transition={{ duration: .1 }} />
          <motion.path fill="none" stroke="#744a47" strokeWidth="2.4" strokeLinecap="round" initial={false} animate={{ d: mouths[mood] }} transition={{ duration: reduced ? 0 : .22 }} />
        </motion.g>
        <Arm shoulder={36} hand={hands[mood].left} reduced={reduced} />
        <Arm shoulder={84} hand={hands[mood].right} reduced={reduced} />
      </motion.g>
    </motion.g>
  </svg>;
}

// The two arrows from the SkillSwap logo, trading places while sign-in runs.
export function SwapLoader({ size = 18 }: { size?: number }) {
  const reduced = useReducedEffects();
  const swap = { duration: .62, repeat: Infinity, repeatType: "reverse" as const, ease: "easeInOut" as const };
  const merge = { y: 0, opacity: 0, transition: { duration: .12 } };
  return <svg className="swap-loader" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <motion.path d="M4 8h15m-4-4 4 4-4 4" animate={reduced ? { opacity: [.55, 1] } : { y: [0, 8] }} exit={merge} transition={swap} />
    <motion.path d="M20 16H5m4 4-4-4 4-4" animate={reduced ? { opacity: [.55, 1] } : { y: [0, -8] }} exit={merge} transition={swap} />
  </svg>;
}

export function DrawnCheck({ size = 20 }: { size?: number }) {
  return <svg className="swap-loader" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <motion.path d="M4 13l5 5L20 6" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: .32, ease: "easeOut" }} />
  </svg>;
}

export function TiltCard({ lifted, children }: { lifted: boolean; children: ReactNode }) {
  const reduced = useReducedEffects();
  const tiltX = useMotionValue(0), tiltY = useMotionValue(0), glow = useMotionValue(0);
  const spotX = useMotionValue(0), spotY = useMotionValue(0);
  const rotateX = useSpring(tiltX, { stiffness: 140, damping: 18 }), rotateY = useSpring(tiltY, { stiffness: 140, damping: 18 }), opacity = useSpring(glow, { stiffness: 120, damping: 24 });
  const background = useMotionTemplate`radial-gradient(300px at ${spotX}px ${spotY}px, #a78bff26, transparent 72%)`;
  function move(event: PointerEvent<HTMLDivElement>) {
    if (reduced || event.pointerType !== "mouse" || !window.matchMedia("(min-width: 900px)").matches) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - box.left, y = event.clientY - box.top;
    tiltX.set((.5 - y / box.height) * 6); tiltY.set((x / box.width - .5) * 6);
    spotX.set(x); spotY.set(y); glow.set(1);
  }
  function leave() { tiltX.set(0); tiltY.set(0); glow.set(0); }
  return <motion.div className="login-form-card" onPointerMove={move} onPointerLeave={leave} style={reduced ? undefined : { rotateX, rotateY, transformPerspective: 1100 }} animate={lifted && !reduced ? { y: -6, scale: 1.012 } : { y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 240, damping: 20 }}>
    <motion.div className="login-card-spotlight" aria-hidden="true" style={{ background, opacity }} />
    {children}
  </motion.div>;
}
