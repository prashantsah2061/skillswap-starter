"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useTransform, type MotionValue, type MotionStyle } from "motion/react";
import { ArrowLeftRight, Check, Hand, Pause, Play, RotateCcw, X } from "lucide-react";
import { useReducedEffects } from "./motion-preferences";
import { SkillAvatar } from "./skill-avatar";
import { communitySkills, compactSlots, desktopSlots, type CommunitySkill } from "./skill-community-data";

type NodePosition = { x: MotionValue<number>; y: MotionValue<number>; baseX: number; baseY: number };
type Pair = { from: number; to: number; label: string };

function SharingLine({ first, second, quiet }: { first: NodePosition; second: NodePosition; quiet: boolean }) {
  const path = useTransform(() => {
    const x1 = first.baseX + first.x.get(), y1 = first.baseY + first.y.get();
    const x2 = second.baseX + second.x.get(), y2 = second.baseY + second.y.get();
    return `M ${x1} ${y1} Q ${(x1+x2)/2} ${Math.min(y1,y2)-38} ${x2} ${y2}`;
  });
  return <svg className="community-sharing" aria-hidden="true"><motion.path data-sharing-line d={path} fill="none" stroke="#7950F2" strokeWidth="2" strokeDasharray={quiet ? undefined : "5 5"} /></svg>;
}

function CommunityNode({ index, skill, position, size, reset, quiet, surge, selected, connected, register, hover, focus, drag, connect, drop }: {
  index: number; skill: CommunitySkill; position: { x: number; y: number }; size: { width: number; height: number }; reset: number; quiet: boolean; surge: boolean; selected: boolean; connected: boolean;
  register: (index: number, node: NodePosition | null) => void; hover: (index: number | null) => void; focus: (index: number | null) => void; drag: (index: number | null) => void; connect: (index: number) => void; drop: (index: number) => void;
}) {
  const reduced = useReducedEffects();
  const x = useMotionValue(0), y = useMotionValue(0), progress = useMotionValue(0);
  const suppressClick = useRef(0);
  const compact = size.width < 440;
  const width = compact ? Math.min(152, size.width * .44) : Math.min(174, size.width * .26);
  const height = 142;
  const baseX = position.x * size.width, baseY = position.y * size.height;
  const bounds = { left: -baseX + width/2 + 2, right: size.width-baseX-width/2-2, top: -baseY+height/2+3, bottom: size.height-baseY-height/2-3 };
  useEffect(() => { register(index, { x, y, baseX, baseY }); return () => register(index, null); }, [register, index, x, y, baseX, baseY]);
  useEffect(() => { x.set(0); y.set(0); }, [reset, size.width, size.height, x, y]);
  useEffect(() => {
    if (quiet || reduced) return;
    const animation = animate(progress, [0,1], { duration: 4.5 + index*.3, repeat: Infinity, delay: index*.4, ease: "linear", repeatDelay: 1 });
    return () => animation.stop();
  }, [quiet, reduced, progress, index]);
  const path = useTransform(() => `M ${size.width*.5} ${size.height*.5} Q ${(size.width*.5+baseX+x.get())/2} ${size.height*.5} ${baseX+x.get()} ${baseY+y.get()}`);
  const signalX = useTransform(() => {
    const t = progress.get(), start = size.width*.5, end = baseX+x.get();
    return start+(end-start)*t;
  });
  const signalY = useTransform(() => {
    const t = progress.get(), start = size.height*.5, end = baseY+y.get();
    return start+(end-start)*t*t;
  });
  // On sign-in, every card sends one pulse down its wire into the hub.
  const surgeProgress = useMotionValue(0);
  useEffect(() => {
    if (!surge) { surgeProgress.set(0); return; }
    const animation = animate(surgeProgress, 1, { duration: .55, delay: index*.05, ease: "easeIn" });
    return () => animation.stop();
  }, [surge, surgeProgress, index]);
  const surgeX = useTransform(() => { const end = baseX+x.get(); return end+(size.width*.5-end)*surgeProgress.get(); });
  const surgeY = useTransform(() => { const end = baseY+y.get(); return end+(size.height*.5-end)*surgeProgress.get(); });
  const surgeOpacity = useTransform(surgeProgress, [0,.08,.92,1], [0,1,1,0]);
  function move(event: KeyboardEvent<HTMLButtonElement>) {
    const step = event.shiftKey ? 30 : 12;
    const delta: Record<string, [number,number]> = { ArrowLeft: [-step,0], ArrowRight: [step,0], ArrowUp: [0,-step], ArrowDown: [0,step] };
    if (event.key === "Home") { event.preventDefault(); x.set(0); y.set(0); }
    if (!delta[event.key]) return;
    event.preventDefault();
    x.set(Math.max(bounds.left, Math.min(bounds.right, x.get()+delta[event.key][0])));
    y.set(Math.max(bounds.top, Math.min(bounds.bottom, y.get()+delta[event.key][1])));
  }
  return <>
    <svg className="community-wire" aria-hidden="true"><motion.path data-community-line={index} d={path} fill="none" stroke={skill.color} strokeWidth="1.2" opacity=".35" />{!quiet && !reduced && <motion.circle cx={signalX} cy={signalY} r="2.6" fill={skill.color} className="community-signal" />}{surge && <motion.circle cx={surgeX} cy={surgeY} r="5" fill={skill.color} opacity={surgeOpacity} className="community-surge" />}</svg>
    <div className={`community-anchor ${selected || connected ? "is-highlighted" : ""}`} style={{ left: `${position.x*100}%`, top: `${position.y*100}%` }}>
      <motion.button type="button" data-community-card={index} data-avatar={skill.id} className={`community-card ${selected ? "is-selected" : ""} ${connected ? "is-connected" : ""}`} aria-label={`${skill.name}, ${skill.category}. Drag toward another card, or select two cards to make an example connection.`} aria-pressed={selected} aria-describedby="community-instructions" style={{ x, y, width, height, marginLeft: -width/2, marginTop: -height/2, "--avatar-accent": skill.color } as MotionStyle & { "--avatar-accent": string }} drag dragConstraints={bounds} dragElastic={0} dragMomentum={false} animate={surge ? { scale: [1,1.05,1], transition: { duration: .5, delay: index*.05 } } : undefined}
        onPointerEnter={()=>hover(index)} onPointerLeave={()=>hover(null)} onFocus={()=>focus(index)} onBlur={()=>focus(null)} onKeyDown={move}
        onDragStart={()=>{drag(index); suppressClick.current=Infinity;}} onDragEnd={()=>{drag(null); suppressClick.current=Date.now()+300;drop(index);}} onClick={()=>{if(Date.now()>suppressClick.current)connect(index);}}>
        <AnimatePresence mode="wait" initial={false}><motion.div className="community-card-content" key={skill.id} initial={{ opacity: 0, y: reduced ? 0 : 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reduced ? 0 : -5 }} transition={{ duration: reduced ? .1 : .35 }}>
          <span className="community-category">{skill.category}</span><SkillAvatar skill={skill} /><strong>{skill.name}</strong><span className="community-card-detail">{skill.detail}</span>
        </motion.div></AnimatePresence><span className="community-card-mark" aria-hidden="true">{selected || connected ? <Check size={12} /> : <Hand size={11} />}</span>
      </motion.button>
    </div>
  </>;
}

export function SkillScene({ activity = "idle" }: { activity?: "idle" | "typing" | "loading" | "success" | "error" }) {
  const reduced = useReducedEffects();
  const scene = useRef<HTMLDivElement>(null), nodes = useRef(new Map<number, NodePosition>());
  const nextSkill = useRef(7), nextSlot = useRef(0);
  const [size, setSize] = useState({ width: 640, height: 480 });
  const [lineup, setLineup] = useState([0,1,2,3,4,5,6]);
  const [hovered, setHovered] = useState<number | null>(null), [focused, setFocused] = useState<number | null>(null), [dragging, setDragging] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null), [pair, setPair] = useState<Pair | null>(null);
  const [linkNodes, setLinkNodes] = useState<{ first: NodePosition; second: NodePosition } | null>(null);
  const [reset, setReset] = useState(0), [paused, setPaused] = useState(false), [inView, setInView] = useState(true), [tabVisible, setTabVisible] = useState(true);
  const compact = size.width < 440;
  const slots = compact ? compactSlots : desktopSlots;
  const interacting = hovered !== null || focused !== null || dragging !== null || selected !== null || pair !== null;
  const quiet = paused || reduced || !inView || !tabVisible;
  const surge = activity === "success" && !quiet;
  const register = useCallback((index: number, node: NodePosition | null) => { if (node) nodes.current.set(index,node); else nodes.current.delete(index); }, []);
  useEffect(() => {
    const element = scene.current; if (!element) return;
    const resize = new ResizeObserver(([entry])=>{ setSize({ width: entry.contentRect.width, height: entry.contentRect.height }); setPair(null); setSelected(null); });
    const visibility = new IntersectionObserver(([entry])=>setInView(entry.isIntersecting), { threshold: .1 });
    const checkTab = () => setTabVisible(document.visibilityState === "visible");
    resize.observe(element); visibility.observe(element); document.addEventListener("visibilitychange",checkTab); checkTab();
    return () => { resize.disconnect(); visibility.disconnect(); document.removeEventListener("visibilitychange",checkTab); };
  }, []);
  useEffect(() => {
    if (quiet || interacting) return;
    const timer = setInterval(()=>{
      const updated = [...lineup], visible = new Set(lineup.slice(0,slots.length));
      for (let swap=0;swap<(compact?1:2);swap++) {
        while (visible.has(nextSkill.current % communitySkills.length)) nextSkill.current++;
        const id = nextSkill.current++ % communitySkills.length;
        const slot = (nextSlot.current + swap*3) % slots.length;
        // On phones, a character may currently occupy an off-screen slot.
        // Swap its old place too so expanding the layout never shows duplicates.
        const hiddenSlot = updated.findIndex((value, position) => position >= slots.length && value === id);
        if (hiddenSlot >= 0) updated[hiddenSlot] = updated[slot];
        updated[slot] = id; visible.add(id);
      }
      nextSlot.current=(nextSlot.current+1)%slots.length;
      setLineup(updated);
    }, 8000);
    return () => clearInterval(timer);
  }, [quiet, interacting, compact, slots.length, lineup]);
  useEffect(() => { if (!pair) return; const timer=setTimeout(()=>setPair(null),7000);return()=>clearTimeout(timer); }, [pair]);
  function join(from: number, to: number) {
    const first = nodes.current.get(from), second = nodes.current.get(to);
    if (!first || !second) return;
    setLinkNodes({ first, second });
    setPair({ from, to, label: `${communitySkills[lineup[from]].name} + ${communitySkills[lineup[to]].name}` }); setSelected(null);
  }
  function connect(index: number) {
    if (selected === index) { setSelected(null); return; }
    if (selected === null) { setPair(null); setSelected(index); } else join(selected,index);
  }
  function drop(index: number) {
    const first=nodes.current.get(index);if(!first)return;
    let nearest=-1, distance=Infinity;
    for(const [other,node] of nodes.current){if(other===index || other>=slots.length)continue;const d=Math.hypot(first.baseX+first.x.get()-node.baseX-node.x.get(),first.baseY+first.y.get()-node.baseY-node.y.get());if(d<distance){nearest=other;distance=d;}}
    if(nearest>=0 && distance<(compact?100:140))join(index,nearest);
  }
  return <div className={`network-block community-network scene-${activity} ${compact ? "community-is-compact" : ""} ${quiet ? "community-is-quiet" : ""}`}>
    <div className="community-toolbar"><div><span className="community-presence" /> A WORLD OF SKILLS<span className="community-toolbar-sub">Everyone has something to share</span></div><div className="community-controls"><button type="button" onClick={()=>setPaused(p=>!p)} aria-label={paused ? "Play community animations" : "Pause community animations"}>{paused ? <Play size={12} /> : <Pause size={12} />}</button><button type="button" onClick={()=>{setReset(r=>r+1);setPair(null);setSelected(null);}} aria-label="Reset community cards"><RotateCcw size={12} /></button></div></div>
    <div className="skill-scene community-scene" ref={scene} role="group" aria-label="Illustrated community of skills">
      <div className="community-orbit" aria-hidden="true" /><div className="community-orbit community-orbit-inner" aria-hidden="true" />
      {slots.map((position,index)=><CommunityNode key={index} index={index} skill={communitySkills[lineup[index]]} position={position} size={size} reset={reset} quiet={quiet} surge={surge} selected={selected===index} connected={pair?.from===index||pair?.to===index} register={register} hover={setHovered} focus={setFocused} drag={setDragging} connect={connect} drop={drop} />)}
      {pair && linkNodes && <SharingLine first={linkNodes.first} second={linkNodes.second} quiet={quiet} />}
      {surge && <motion.div className="community-shock" aria-hidden="true" style={{ x: "-50%", y: "-50%" }} initial={{ scale: .6, opacity: 0 }} animate={{ scale: 6, opacity: [0,.65,0] }} transition={{ duration: .85, delay: .45, ease: "easeOut" }} />}
      <motion.div className="community-center" aria-hidden="true" style={{ x: "-50%", y: "-50%" }} animate={surge ? { scale: [1,1,1.3,1], transition: { duration: 1, times: [0,.45,.65,1] } } : undefined}><motion.span className="community-center-icon" animate={activity === "loading" && !quiet ? { rotate: 360 } : { rotate: 0 }} transition={activity === "loading" && !quiet ? { duration: 1.1, repeat: Infinity, ease: "easeInOut" } : { duration: 0 }}><ArrowLeftRight size={27} /></motion.span><span>SkillSwap</span><small>BETTER TOGETHER</small></motion.div>
    </div>
    <div className="community-feedback" id="community-instructions" role="status" aria-live="polite"><AnimatePresence mode="wait" initial={false}>{pair ? <motion.div key="connected" className="community-connection-message" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><span>{pair.label}</span><strong>You teach. I learn. We grow together.</strong><button type="button" aria-label="Clear example connection" onClick={()=>setPair(null)}><X size={13} /></button></motion.div> : <motion.p key={selected === null ? "hint" : "select"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>{selected === null ? <><Hand size={12} /> Drag two skills together, or select a pair.</> : <>Now choose a skill to connect with {communitySkills[lineup[selected]].name}.</>}</motion.p>}</AnimatePresence></div>
    <p className="community-disclaimer">Illustrated community · connections are examples, not real matches.</p>
  </div>;
}
