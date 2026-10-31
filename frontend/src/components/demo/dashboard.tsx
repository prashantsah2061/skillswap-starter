"use client";
import Link from "next/link";
import { useDemo } from "./demo-provider";
import { Reveal } from "@/components/ui/motion";
export function DashboardSummary() {
  const { data } = useDemo();
  const counts = Object.entries(data.counts);
  return (
    <>
      <Reveal as="h1">Welcome, {data.profile.display_name}</Reveal>
      <Reveal as="p" className="subtitle" delay={0.08}>
        Your SkillSwap activity
      </Reveal>
      <div className="matches-grid">
        {counts.map(([label, count], index) => (
          <Reveal as="article" className="card" key={label} delay={0.14} index={index} lift>
            <h2>{count}</h2>
            <p>{label}</p>
          </Reveal>
        ))}
      </div>
      <Reveal delay={0.14 + Math.min(counts.length, 8) * 0.05}>
        {!data.profile.onboarded && (
          <p>Add a bio and your skills to appear in Discover.</p>
        )}
        <Link className="button lime" href="/profile">
          Edit profile & skills
        </Link>{" "}
        <Link className="button" href="/discover">
          Discover partners
        </Link>{" "}
        <Link className="button" href="/sessions">
          Your sessions
        </Link>
      </Reveal>
    </>
  );
}
