import type { ReactNode } from "react";
import { SiteNav } from "@/components/layout/site-nav";
import { StarterNotice } from "@/components/ui/starter-notice";
// TODO: requireUser() here when auth is implemented. This route group is NOT protected yet.
export default function AppLayout({children}:{children:ReactNode}){return <main className="shell"><SiteNav/><StarterNotice/>{children}</main>}
