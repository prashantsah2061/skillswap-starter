import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DemoProvider } from "@/components/demo/demo-provider";
import "./globals.css";
export const metadata: Metadata = {
  title: "SkillSwap | Learn something. Share something.",
  description: "Discover your next skill partner. A frontend capstone demo.",
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <DemoProvider>{children}</DemoProvider>
      </body>
    </html>
  );
}
