"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Search, Shuffle } from "lucide-react";
import { Header } from "@/components/ui/Header";
import { BeadArt } from "@/components/ui/BeadArt";
import { PRESETS, createProject, type Preset } from "@/lib/presets";
import { saveProject } from "@/lib/storage";
import { useEditor } from "@/stores/editor";
export function PresetLibrary() {
  const router = useRouter(),
    [category, setCategory] = useState("All"),
    [search, setSearch] = useState(""),
    [error, setError] = useState("");
  const categories = ["All", ...new Set(PRESETS.map((p) => p.category))];
  const presets = PRESETS.filter(
    (p) =>
      (category === "All" || p.category === category) &&
      `${p.name} ${p.description}`.toLowerCase().includes(search.toLowerCase()),
  );
  function open(p: Preset, game = false) {
    const project = createProject(p.size, p, game);
    useEditor.getState().load(project);
    try {
      saveProject(project);
      router.push(`/create/${project.id}`);
    } catch {
      setError(
        "Your browser could not save a new project. Free up browser storage and try again.",
      );
    }
  }
  return (
    <>
      <Header />
      <main className="library-main">
        <div className="library-heading">
          <div>
            <h1>
              A little inspiration.
              <br />A whole lot of possibility.
            </h1>
            <p>
              Original patterns for happy little making sessions. Pick one and
              make it yours.
            </p>
          </div>
          <button
            className="secondary"
            onClick={() =>
              open(PRESETS[Math.floor(Math.random() * PRESETS.length)])
            }
          >
            <Shuffle size={17} />
            Surprise me
          </button>
        </div>
        <div className="library-filters" aria-label="Template categories">
          {categories.map((c) => (
            <button
              key={c}
              className={category === c ? "active" : ""}
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
            >
              {c}
            </button>
          ))}
          <label className="library-search">
            <Search size={16} />
            <input
              aria-label="Search templates"
              placeholder="Find a little something…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        {error ? (
          <p className="error-copy" role="alert">
            {error}
          </p>
        ) : null}
        <div className="preset-grid">
          {presets.map((p) => (
            <article key={p.id} className="preset-card">
              <div
                className="preset-picture"
                style={{ background: p.background }}
              >
                <BeadArt cells={p.cells} width={p.size} name={p.name} />
              </div>
              <div className="preset-info">
                <h2>{p.name}</h2>
                <p>{p.description}</p>
                <div className="preset-meta">
                  <span>{p.difficulty}</span>
                  <span>{p.cells.filter(Boolean).length} beads</span>
                  <span>
                    {p.size} × {p.size}
                  </span>
                </div>
                <div className="preset-actions">
                  <button className="primary" onClick={() => open(p)}>
                    Make it yours <ArrowRight size={13} />
                  </button>
                  <button className="secondary" onClick={() => open(p, true)}>
                    Follow pattern
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
        {!presets.length ? (
          <div className="empty-library">
            <h2>No tiny treasures here yet.</h2>
            <p>Try another name or category.</p>
            <button
              className="secondary"
              onClick={() => {
                setCategory("All");
                setSearch("");
              }}
            >
              Show every template
            </button>
          </div>
        ) : null}
        <footer className="studio-footer">
          <span>Every template is original. Every remix is yours.</span>
          <Link href="/create">
            Start with a blank board <ArrowRight size={13} />
          </Link>
        </footer>
      </main>
    </>
  );
}
