"use client";
import Image from "next/image";
import { useState } from "react";
import Link from "next/link";
import { categories, skillDetails } from "@/lib/frontend-data";
import { useDemo } from "./demo-provider";
import { Search, Badge } from "./ui";
export function Explore() {
  const [query, setQuery] = useState("");
  const filtered = categories.filter((c) =>
    `${c.name} ${c.examples} ${c.skills.join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <>
      <p className="breadcrumb">
        ⌂ <span>›</span> Explore
      </p>
      <h1>What do you want to learn?</h1>
      <p className="subtitle">Explore a skill. Find someone to swap with.</p>
      <Search value={query} onChange={setQuery} placeholder="Search skills" />
      <div className="category-grid">
        {filtered.map((c) => (
          <Link
            href={`/explore/${c.id}`}
            key={c.id}
            className={`category-card ${c.id === "technical" ? "featured" : ""}`}
          >
            <span className={`category-icon ${c.id}`}>{c.icon}</span>
            <h2>{c.name}</h2>
            <p>{c.examples}</p>
            <Image
              unoptimized
              width={300}
              height={240}
              src={`/images/demo/${c.id}.webp`}
              alt=""
            />
            <span className="category-link">
              Explore skills <b>→</b>
            </span>
          </Link>
        ))}
      </div>
      {!filtered.length && (
        <div className="empty card">
          <h2>No skills found</h2>
          <p>Try “Python”, “design”, or another skill.</p>
          <button className="button" onClick={() => setQuery("")}>
            Clear search
          </button>
        </div>
      )}
      <p className="page-note">
        A little curiosity goes a long way. What will you learn next?
      </p>
    </>
  );
}
export function Category({ id }: { id: string }) {
  const c = categories.find((c) => c.id === id);
  const { data, update } = useDemo();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  if (!c)
    return (
      <div className="empty">
        <h1>Category not found</h1>
        <Link href="/explore" className="button">
          Explore skills
        </Link>
      </div>
    );
  const skills = c.skills.filter(
    (s) =>
      s.toLowerCase().includes(query.toLowerCase()) &&
      (filter === "All" || skillDetails[s]?.group === filter),
  );
  const add = (s: string) =>
    update((p) => ({
      ...p,
      profile: {
        ...p.profile,
        learns: p.profile.learns.includes(s)
          ? p.profile.learns.filter((x) => x !== s)
          : [...p.profile.learns, s],
      },
    }));
  return (
    <div className="category-layout">
      <section>
        <p className="breadcrumb">
          <Link href="/explore">Explore skills</Link>
          <span>/</span>
          {c.name}
        </p>
        <h1>{c.name}</h1>
        <p className="subtitle">{c.subtitle}</p>
        <div className="filter-bar">
          <Search
            value={query}
            onChange={setQuery}
            placeholder={`Search ${c.name.toLowerCase()}`}
          />
          {(id === "technical"
            ? ["All", "Coding", "Data", "Design tools"]
            : ["All"]
          ).map((f) => (
            <button
              className={`chip ${filter === f ? "selected" : ""}`}
              key={f}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="skill-list">
          {skills.map((s, i) => {
            const d = skillDetails[s] || {
              icon: c.icon,
              description: `Learn ${s.toLowerCase()} with a friendly partner and build your confidence through practice.`,
              level: "All levels",
            };
            const added = data.profile.learns.includes(s);
            return (
              <article key={s} className="skill-row card">
                <span className={`skill-icon color-${i % 4}`}>{d.icon}</span>
                <div className="skill-copy">
                  <h2>{s}</h2>
                  <p>{d.description}</p>
                </div>
                <Badge
                  tone={
                    d.level === "Intermediate"
                      ? "purple"
                      : d.level === "All levels"
                        ? "mint"
                        : "blue"
                  }
                >
                  ▥ &nbsp; {d.level}
                </Badge>
                <div className="skill-actions">
                  <Link
                    className="button"
                    href={`/discover?skill=${encodeURIComponent(s)}`}
                  >
                    Find a swap <span>→</span>
                  </Link>
                  <button
                    className="text-button"
                    aria-pressed={added}
                    onClick={() => add(s)}
                  >
                    {added ? "✓ On your list" : "+ Add to list"}
                  </button>
                </div>
              </article>
            );
          })}
          {!skills.length && (
            <div className="card empty">
              <h2>No skills match</h2>
              <button
                className="button"
                onClick={() => {
                  setQuery("");
                  setFilter("All");
                }}
              >
                Reset filters
              </button>
            </div>
          )}
        </div>
      </section>
      <aside className="learning-sidebar card">
        <div className="learning-heading">
          <h2>Your learning list</h2>
          <p>Pair what you want to learn with a skill you can teach.</p>
        </div>
        {data.profile.learns.map((s) => (
          <div className="learning-item" key={s}>
            <span className="mini-icon">{skillDetails[s]?.icon || "✦"}</span>
            <strong>{s}</strong>
            <button
              aria-label={`Remove ${s} from learning list`}
              onClick={() => add(s)}
            >
              ×
            </button>
          </div>
        ))}
        {!data.profile.learns.length && (
          <p className="muted">
            Your list is ready for a little inspiration. Add a skill below.
          </p>
        )}
        <label className="add-select">
          <span>+ Add another skill</span>
          <select
            aria-label="Add a skill to learning list"
            value=""
            onChange={(e) => {
              if (e.target.value) add(e.target.value);
            }}
          >
            <option value="">Choose a skill…</option>
            {categories
              .flatMap((c) => c.skills)
              .filter((s) => !data.profile.learns.includes(s))
              .map((s) => (
                <option key={s}>{s}</option>
              ))}
          </select>
        </label>
        <div className="sidebar-tips">
          <h3>Not sure what to learn?</h3>
          <p>Explore popular skills and see what sparks your curiosity.</p>
          {[
            ["▥", "Popular this month", "Python, Web development, Figma"],
            ["♧", "Learn with others", "A little give. A lot of growth."],
            [
              "☼",
              "Turn skills into opportunities",
              "Teach what you know, learn what you need",
            ],
          ].map(([icon, title, text]) => (
            <div className="tip" key={title}>
              <span>{icon}</span>
              <div>
                <strong>{title}</strong>
                <small>{text}</small>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
