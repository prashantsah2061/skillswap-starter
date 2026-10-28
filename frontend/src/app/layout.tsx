import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./theme.css";
import "./globals.css";
export const metadata: Metadata = {
  title: "SkillSwap | Learn something. Share something.",
  description: "Discover your next skill partner. A frontend capstone demo.",
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
