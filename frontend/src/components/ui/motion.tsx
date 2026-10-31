"use client";
import { useRef, type ReactNode, type Ref } from "react";
import { MotionConfig, motion, useMotionValue, useTransform } from "motion/react";
import { useReducedEffects } from "@/components/auth/motion-preferences";

export const softSpring = { type: "spring", stiffness: 420, damping: 34 } as const;
const easeOut = [0.22, 1, 0.36, 1] as const;

// Motion then drops transform and layout animations for reduced-motion users.
// Components below also skip decorative movement outright.
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

// Opacity only: a lingering transform here would become the containing block
// for everything on the page.
export function PageFade({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

// Staggers by index instead of parent variants, because lists here arrive after
// their parent has mounted and variant orchestration would not reach them.
export function Reveal({
  as = "div",
  index = 0,
  delay = 0,
  lift = false,
  className,
  children,
}: {
  as?: "div" | "article" | "aside" | "p" | "h1";
  index?: number;
  delay?: number;
  lift?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const reduced = useReducedEffects();
  const Tag = motion[as] as typeof motion.div;
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y: reduced ? 0 : 14 }}
      // The delay lives on `animate` so it never applies to hover end.
      animate={{
        opacity: 1,
        y: 0,
        transition: {
          duration: 0.4,
          ease: easeOut,
          delay: reduced ? 0 : delay + Math.min(index, 8) * 0.05,
        },
      }}
      whileHover={lift && !reduced ? { y: -3 } : undefined}
      transition={softSpring}
    >
      {children}
    </Tag>
  );
}

export function SwipeCard({
  direction,
  pending,
  disabled,
  onSwipe,
  className,
  children,
  ref,
}: {
  direction: number;
  pending: boolean;
  disabled: boolean;
  onSwipe: (right: boolean) => void;
  className?: string;
  children: ReactNode;
  ref?: Ref<HTMLElement>;
}) {
  const reduced = useReducedEffects();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-320, 320], [-14, 14]);
  const dragged = useRef(false);
  return (
    <motion.article
      ref={ref}
      className={className}
      style={{ x, rotate: reduced ? 0 : rotate }}
      drag={disabled ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      dragMomentum={false}
      onPointerDownCapture={() => {
        dragged.current = false;
      }}
      onDragStart={() => {
        dragged.current = true;
      }}
      onDragEnd={(_, info) => {
        if (Math.abs(info.offset.x) > 65 || Math.abs(info.velocity.x) > 500)
          onSwipe(info.offset.x > 0);
      }}
      // Releasing a swipe over a link or button must not also click it.
      onClickCapture={(e) => {
        if (dragged.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      initial={{ opacity: 0, scale: reduced ? 1 : 0.96, y: reduced ? 0 : 10 }}
      // Holds the card leaning while the decision saves, and returns it on failure.
      animate={{
        opacity: 1,
        scale: 1,
        y: 0,
        x: pending && !reduced ? direction * 70 : 0,
      }}
      variants={{
        exit: (dir: number) => ({
          x: reduced ? 0 : dir * 420,
          opacity: 0,
          zIndex: 3,
          transition: { duration: 0.26, ease: "easeIn" },
        }),
      }}
      exit="exit"
      whileHover={disabled || reduced ? undefined : { scale: 1.015 }}
      transition={softSpring}
    >
      {children}
    </motion.article>
  );
}

export function TypingDots({ label }: { label?: string }) {
  const reduced = useReducedEffects();
  return (
    <span className="typing-dots" role={label ? "status" : undefined} aria-label={label}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          animate={reduced ? undefined : { y: [0, -4, 0], opacity: [0.45, 1, 0.45] }}
          transition={{ duration: 0.9, delay: i * 0.14, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </span>
  );
}

export function MatchBurst() {
  const reduced = useReducedEffects();
  return (
    <div className="match-burst" aria-hidden="true">
      {!reduced &&
        [0, 60, 120, 180, 240, 300].map((angle) => (
          <motion.i
            key={angle}
            initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            animate={{
              opacity: 0,
              x: Math.cos((angle * Math.PI) / 180) * 42,
              y: Math.sin((angle * Math.PI) / 180) * 42,
              scale: 0.4,
            }}
            transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
          />
        ))}
      <motion.b
        initial={{ scale: reduced ? 1 : 0.3 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 14 }}
      >
        ♥
      </motion.b>
    </div>
  );
}
