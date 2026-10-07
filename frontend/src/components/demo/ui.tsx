"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useId, type ReactNode } from "react";
export function Logo() {
  return (
    <Link className="brand" href="/explore" aria-label="SkillSwap explore">
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
  children,
  onClose,
}: {
  title: string;
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
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button className="close" aria-label="Close dialog" onClick={onClose}>
        ×
      </button>
      <h2 id={titleId}>{title}</h2>
      {children}
    </dialog>
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
