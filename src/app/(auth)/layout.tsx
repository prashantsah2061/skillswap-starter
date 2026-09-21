import type { ReactNode } from "react";
import { SiteNav } from "@/components/layout/site-nav";
import { StarterNotice } from "@/components/ui/starter-notice";
export default function AuthLayout({children}:{children:ReactNode}){return <main className="shell"><SiteNav/><StarterNotice/>{children}</main>}
