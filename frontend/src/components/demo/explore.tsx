"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import { useDemo, community } from "./demo-provider";
import { Search, Badge } from "./ui";
const MotionLink = motion.create(Link);
const icons: Record<string, string> = {
  living: "⌂",
  technical: "⌘",
  creative: "✿",
  music: "♫",
  languages: "☏",
  wellness: "♧",
  career: "▥",
};
export function Explore() {
  const { data } = useDemo(),
    [query, setQuery] = useState("");
  const filtered = data.categories.filter((c) =>
    (
      c.name +
      " " +
      data.skills
        .filter((s) => s.category_id === c.id)
        .map((s) => s.name)
        .join(" ")
    )
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <>
      <h1>What do you want to learn?</h1>
      <p className="subtitle">Explore a skill. Find someone to swap with.</p>
      <Search value={query} onChange={setQuery} placeholder="Search skills" />
      <div className="category-grid">
        {filtered.map((c, index) => (
          // Opacity only: the card's own CSS hover owns its transform.
          <MotionLink
            className={`category-card ${c.id === "technical" ? "featured" : ""}`}
            href={`/explore/${c.id}`}
            key={c.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.05 }}
          >
            <span className={`category-icon ${c.id}`}>
              {icons[c.id] || "✦"}
            </span>
            <h2>{c.name}</h2>
            <p>
              {data.skills
                .filter((s) => s.category_id === c.id)
                .slice(0, 5)
                .map((s) => s.name)
                .join(" · ")}
            </p>
            {[
              "living",
              "technical",
              "creative",
              "languages",
              "wellness",
              "career",
              "music",
            ].includes(c.id) && (
              <Image
                unoptimized
                width={300}
                height={240}
                src={`/images/demo/${c.id === "music" ? "creative" : c.id}.webp`}
                alt=""
              />
            )}
            <span className="category-link">Explore skills →</span>
          </MotionLink>
        ))}
      </div>
      {!!data.categories.length && !filtered.length && (
        <div className="card empty">
          <h2>No skills match your search</h2>
          <button className="button" onClick={() => setQuery("")}>
            Clear search
          </button>
        </div>
      )}
      {!data.categories.length && (
        <p>Skills are not available yet. Please check back soon.</p>
      )}
      <Link className="button" href="/discover">
        Discover members →
      </Link>
    </>
  );
}
export function Category({ id }: { id: string }) {
  const { data, refresh } = useDemo(),
    [query, setQuery] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const category = data.categories.find((c) => c.id === id);
  async function toggle(skill_id: string) {
    setBusy(true);
    try {
      const exists = data.selections.some(
        (s) => s.skill_id === skill_id && s.direction === "learn",
      );
      await community(
        {
          op: "selection",
          skill: skill_id,
          direction: "learn",
          level: "beginner",
          remove: exists,
        },
        true,
      );
      await refresh();
      setNotice("Learning list saved.");
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="category-layout">
      <section>
        <Link href="/explore" className="breadcrumb">
          ← Explore skills
        </Link>
        <h1>{category?.name || "Category unavailable"}</h1>
        <Search value={query} onChange={setQuery} placeholder="Search skills" />
        {notice && <p role="status">{notice}</p>}
        {!data.skills.some(
          (s) =>
            s.category_id === id &&
            s.name.toLowerCase().includes(query.toLowerCase()),
        ) && <p>No skills match. Try another search or category.</p>}
        <div className="skill-list">
          {data.skills
            .filter(
              (s) =>
                s.category_id === id &&
                s.name.toLowerCase().includes(query.toLowerCase()),
            )
            .map((s, i) => (
              <article className="skill-row card" key={s.id}>
                <span className={`skill-icon color-${i % 4}`}>
                  {icons[id] || "✦"}
                </span>
                <div className="skill-copy">
                  <h2>{s.name}</h2>
                  <p>Practice and exchange skills with a member.</p>
                </div>
                <Badge>All levels</Badge>
                <div className="skill-actions">
                  <Link
                    className="button"
                    href={`/discover?skill=${encodeURIComponent(s.name)}`}
                  >
                    Find a swap →
                  </Link>
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => toggle(s.id)}
                  >
                    {data.selections.some(
                      (x) => x.skill_id === s.id && x.direction === "learn",
                    )
                      ? "✓ On your list"
                      : "+ Add to list"}
                  </button>
                </div>
              </article>
            ))}
        </div>
      </section>
      <aside className="learning-sidebar card">
        <h2>Your learning list</h2>
        {data.selections
          .filter((s) => s.direction === "learn")
          .map((s) => (
            <div className="learning-item" key={s.skill_id}>
              <strong>
                {data.skills.find((k) => k.id === s.skill_id)?.name}
              </strong>
              <button disabled={busy} onClick={() => toggle(s.skill_id)}>
                Remove
              </button>
            </div>
          ))}
        {!data.selections.some((s) => s.direction === "learn") && (
          <p>No learning skills selected yet.</p>
        )}
      </aside>
    </div>
  );
}
