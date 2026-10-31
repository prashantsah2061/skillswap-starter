"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Logo, Photo } from "@/components/demo/ui";
import { useAccount } from "@/components/auth/account-provider";
import { LogoutButton } from "@/components/auth/logout-button";
import { useReducedEffects } from "@/components/auth/motion-preferences";
import { softSpring } from "@/components/ui/motion";
const MotionLink = motion.create(Link);
export function SiteNav() {
  const account = useAccount();
  const path = usePathname();
  const reduced = useReducedEffects();
  // `details` stays open until the menu's exit animation has finished.
  const [open, setOpen] = useState(false),
    [rendered, setRendered] = useState(false);
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!menu.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      menu.current?.querySelector("summary")?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <header className="topbar">
      <div className="nav-inner">
        <Logo />
        <nav aria-label="Main navigation">
          {[
            ["Explore", "/explore"],
            ["Matches", "/matches"],
            ["Messages", "/messages"],
            ["Sessions", "/sessions"],
          ].map(([name, href]) => {
            const active =
              path.startsWith(href) ||
              (href === "/matches" && path === "/discover");
            return (
              <MotionLink
                key={href}
                href={href}
                className={active ? "active" : ""}
                whileTap={reduced ? undefined : { scale: 0.96 }}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="nav-indicator"
                    transition={reduced ? { duration: 0 } : softSpring}
                  />
                )}
                {name}
              </MotionLink>
            );
          })}
        </nav>
        <details className="avatar-menu" ref={menu} open={rendered}>
          <summary
            onClick={(e) => {
              e.preventDefault();
              if (!open) setRendered(true);
              setOpen(!open);
            }}
          >
            <Photo photo={account.profile?.avatar_url || ""} alt={account.name} />
            <span>{account.name}</span>
            <span aria-hidden="true">⌄</span>
          </summary>
          <AnimatePresence onExitComplete={() => setRendered(false)}>
            {open && (
              <motion.div
                style={{ transformOrigin: "top right" }}
                initial={{ opacity: 0, y: reduced ? 0 : -6, scale: reduced ? 1 : 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: reduced ? 0 : -4, scale: reduced ? 1 : 0.98 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
              >
                <Link href="/profile" onClick={() => setOpen(false)}>
                  Your profile
                </Link>
                <Link href="/security" onClick={() => setOpen(false)}>
                  Account security
                </Link>
                <LogoutButton />
              </motion.div>
            )}
          </AnimatePresence>
        </details>
      </div>
    </header>
  );
}
