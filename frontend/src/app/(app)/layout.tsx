import type { ReactNode } from "react";
import { SiteNav } from "@/components/layout/site-nav";
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteNav />
      <main className="shell">{children}</main>
    </>
  );
}
