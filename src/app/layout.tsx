import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
export const metadata: Metadata = { title: "SkillSwap | Capstone Starter", description: "Teach what you know. Learn something new." };
export default function RootLayout({ children }: { children: ReactNode }) {
 return <html lang="en"><body>{children}</body></html>;
}
