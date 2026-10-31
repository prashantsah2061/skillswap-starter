"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useId, type ReactNode } from "react";
import { motion } from "motion/react";
export function Logo({ href = "/explore" }: { href?: string }) {
  return (
    <Link
      className="brand"
      href={href}
      aria-label={href === "/login" ? "SkillSwap sign in" : "SkillSwap explore"}
    >
      <span className="logo-arrows" aria-hidden="true">
        <b>➜</b>
        <b>➜</b>
      </span>
      SkillSwap
    </Link>
  );
}
export function Badge({
  children,
  tone = "blue",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Search({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (s: string) => void;
  placeholder: string;
}) {
  return (
    <div className="search">
      <span aria-hidden="true">⌕</span>
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button aria-label="Clear search" onClick={() => onChange("")}>
          ×
        </button>
      )}
    </div>
  );
}
export function Dialog({
  title,
  icon,
  children,
  onClose,
}: {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return (
    <motion.dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      initial={{ opacity: 0, scale: 0.96, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: 6 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      onCancel={(e) => {
        // Escape would otherwise close the dialog before its exit animation.
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button className="close" aria-label="Close dialog" onClick={onClose}>
        ×
      </button>
      {icon}
      <h2 id={titleId}>{title}</h2>
      {children}
    </motion.dialog>
  );
}
export function Photo({
  photo,
  alt,
  className = "",
}: {
  photo: string;
  alt: string;
  className?: string;
}) {
  if (!photo)
    return (
      <span
        className={`member-avatar ${className}`}
        role="img"
        aria-label={alt || "Member avatar"}
      >
        {alt.trim().slice(0, 1).toUpperCase() || "✦"}
      </span>
    );
  return (
    <Image
      unoptimized
      width={600}
      height={400}
      className={className}
      src={`/images/demo/${photo}.webp`}
      alt={alt}
    />
  );
}
