import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/require-user";
import { initialDisplayName } from "@/lib/auth/validation";
import { loadProfile } from "@/lib/profile/server";
import { AccountProvider } from "@/components/auth/account-provider";
import { DemoProvider } from "@/components/demo/demo-provider";
import { SessionWatch } from "@/components/auth/session-watch";
import { SiteNav } from "@/components/layout/site-nav";
import { MotionProvider } from "@/components/ui/motion";
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser(true);
  const profile = await loadProfile();
  return (
    <AccountProvider
      key={user.id}
      profile={profile}
      fallback={initialDisplayName(user)}
    >
      <SessionWatch />
      <MotionProvider>
        <SiteNav />
        <main className="shell">
          <DemoProvider key={user.id}>{children}</DemoProvider>
        </main>
      </MotionProvider>
    </AccountProvider>
  );
}
