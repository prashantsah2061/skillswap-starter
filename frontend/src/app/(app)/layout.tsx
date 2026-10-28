import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/require-user";
import { initialDisplayName } from "@/lib/auth/validation";
import { loadProfile } from "@/lib/profile/server";
import { AccountProvider } from "@/components/auth/account-provider";
import { DemoProvider } from "@/components/demo/demo-provider";
import { SessionWatch } from "@/components/auth/session-watch";
import { SiteNav } from "@/components/layout/site-nav";
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser(true);
  const profile = await loadProfile();
  return <AccountProvider key={user.id} profile={profile} fallback={initialDisplayName(user)}><DemoProvider key={user.id} storageKey={`skillswap-demo-v2-${user.id}`}><SessionWatch /><SiteNav /><main className="shell">{children}</main></DemoProvider></AccountProvider>;
}
