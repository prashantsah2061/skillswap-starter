"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo, Photo } from "@/components/demo/ui";
import { useAccount } from "@/components/auth/account-provider";
import { LogoutButton } from "@/components/auth/logout-button";
import { useDemo } from "@/components/demo/demo-provider";
export function SiteNav() {
  const account = useAccount();
  const path = usePathname();
  const { data } = useDemo();
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
          ].map(([name, href]) => (
            <Link
              key={href}
              href={href}
              className={
                path.startsWith(href) ||
                (href === "/matches" && path === "/discover")
                  ? "active"
                  : ""
              }
            >
              {name}
            </Link>
          ))}
        </nav>
        <details className="avatar-menu">
          <summary>
            <Photo photo={data.profile.photo} alt="" />
            <span>{account.name}</span>
            <span aria-hidden="true">⌄</span>
          </summary>
          <div>
            <Link href="/profile">Your profile</Link>
            <Link href="/security">Account security</Link>
            <LogoutButton />
          </div>
        </details>
      </div>
    </header>
  );
}
