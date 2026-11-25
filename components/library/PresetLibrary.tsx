"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Bookmark, Search, Shuffle } from "lucide-react";
import { Header } from "@/components/ui/Header";
import { BeadArt } from "@/components/ui/BeadArt";
import { PRESETS, createProject, type Preset } from "@/lib/presets";
import { Modal } from "@/components/ui/Modal";
import { COLOR_MAP } from "@/lib/colors";
import { readProjects, saveProject } from "@/lib/storage";
import { useEditor } from "@/stores/editor";
const bookmarkKey = (id: string) => `pindou.template.saved.v1.${id}`;
const keywords = new Map(
  PRESETS.map((p) => [
    p.id,
    [
      p.name,
      p.description,
      p.category,
      p.difficulty,
      "PinDou Studio",
      ...new Set(p.cells.flatMap((c) => (c ? [COLOR_MAP[c].name] : []))),
    ]
      .join(" ")
      .toLowerCase(),
  ]),
);
export function PresetLibrary() {
  const router = useRouter(),
    [category, setCategory] = useState("All"),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState("featured"),
    [savedOnly, setSavedOnly] = useState(false),
    [saved, setSaved] = useState<string[]>([]),
    [usage, setUsage] = useState<Map<string, { count: number; last: string }>>(
      new Map(),
    ),
    [preview, setPreview] = useState<Preset | null>(null),
    [error, setError] = useState("");
  const categories = ["All", ...new Set(PRESETS.map((p) => p.category))];
  useEffect(() => {
    function refresh() {
      try {
        setSaved(
          PRESETS.filter(
            (p) => localStorage.getItem(bookmarkKey(p.id)) === "1",
          ).map((p) => p.id),
        );
        const stats: typeof usage = new Map();
        for (const p of readProjects()) {
          if (!p.presetId || p.id === "pocket-frog-demo") continue;
          const entry = stats.get(p.presetId) ?? { count: 0, last: "" };
          stats.set(p.presetId, entry);
          entry.count++;
          if (p.updatedAt > entry.last) entry.last = p.updatedAt;
        }
        setUsage(stats);
      } catch {
        setError(
          "Device storage is unavailable. You can still browse the catalog.",
        );
      }
    }
    refresh();
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, []);
  function bookmark(id: string) {
    try {
      const key = bookmarkKey(id);
      if (localStorage.getItem(key) === "1") {
        localStorage.removeItem(key);
        setSaved((current) => current.filter((item) => item !== id));
      } else {
        localStorage.setItem(key, "1");
        setSaved((current) => [...new Set([...current, id])]);
      }
    } catch {
      setError("This browser could not save your bookmark.");
    }
  }
  const query = search.trim().toLowerCase();
  const words = query.split(/\s+/);
  const exact = PRESETS.find((p) => p.name.toLowerCase() === query);
  const presets = PRESETS.filter(
    (p) =>
      (category === "All" || p.category === category) &&
      (!savedOnly || saved.includes(p.id)) &&
      (exact
        ? p.id === exact.id
        : words.every((word) => keywords.get(p.id)!.includes(word))),
  ).sort((a, b) =>
    sort === "most"
      ? (usage.get(b.id)?.count ?? 0) - (usage.get(a.id)?.count ?? 0)
      : sort === "recent"
        ? (usage.get(b.id)?.last ?? "").localeCompare(
            usage.get(a.id)?.last ?? "",
          )
        : 0,
  );
  function open(p: Preset, game = false) {
    const project = createProject(p.size, p, game);
    try {
      saveProject(project);
      useEditor.getState().load(project);
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
          <button
            className={savedOnly ? "active" : ""}
            aria-pressed={savedOnly}
            onClick={() => setSavedOnly(!savedOnly)}
          >
            Saved ({saved.length})
          </button>
          <select
            aria-label="Sort templates"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="featured">PinDou picks</option>
            <option value="most">Most made on this device</option>
            <option value="recent">Recently edited on this device</option>
          </select>
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
                <button
                  className="preview-template"
                  aria-label={`Preview ${p.name}`}
                  onClick={() => setPreview(p)}
                >
                  <BeadArt cells={p.cells} width={p.size} name={p.name} />
                </button>
                <button
                  className="bookmark-template"
                  title={
                    saved.includes(p.id)
                      ? "Remove bookmark"
                      : "Save on this device"
                  }
                  aria-label={`Save ${p.name} on this device`}
                  aria-pressed={saved.includes(p.id)}
                  onClick={() => bookmark(p.id)}
                >
                  <Bookmark
                    size={17}
                    fill={saved.includes(p.id) ? "currentColor" : "none"}
                  />
                </button>
              </div>
              <div className="preset-info">
                <h2>{p.name}</h2>
                <p>PinDou Studio · {p.category}</p>
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
                setSavedOnly(false);
              }}
            >
              Show every template
            </button>
          </div>
        ) : null}
        {preview && (
          <Modal title={preview.name} onClose={() => setPreview(null)}>
            <div
              className="preset-picture template-detail"
              style={{ background: preview.background }}
            >
              <BeadArt
                cells={preview.cells}
                width={preview.size}
                name={preview.name}
              />
            </div>
            <p className="modal-description">
              {preview.description} · PinDou Studio
            </p>
            <div className="dialog-actions">
              <button className="secondary" onClick={() => open(preview, true)}>
                Follow pattern
              </button>
              <button className="primary" onClick={() => open(preview)}>
                Make it yours <ArrowRight size={14} />
              </button>
            </div>
            {error && (
              <p role="alert" className="error-copy">
                {error}
              </p>
            )}
          </Modal>
        )}
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
