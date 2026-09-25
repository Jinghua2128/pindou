"use client";
import { newId } from "@/lib/id";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, Download, Plus, Trash2 } from "lucide-react";
import { Header } from "@/components/ui/Header";
import { BeadArt } from "@/components/ui/BeadArt";
import { Modal } from "@/components/ui/Modal";
import { deleteProject, readProjects, saveProject } from "@/lib/storage";
import { exportProject } from "@/lib/export";
import type { BeadProject } from "@/types/project";
export function ProjectLibrary() {
  const [projects, setProjects] = useState<BeadProject[] | null>(null),
    [error, setError] = useState(""),
    [remove, setRemove] = useState<BeadProject | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        setProjects(readProjects());
      } catch {
        setError(
          "Your browser’s saved projects could not be read. Project-file backups can still be imported in the studio.",
        );
        setProjects([]);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  function duplicate(p: BeadProject) {
    try {
      const copy = {
        ...structuredClone(p),
        id: newId(),
        name: `${p.name.slice(0, 72)} (copy)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      saveProject(copy);
      setProjects(readProjects());
    } catch {
      setError("The copy could not be saved. Try exporting a project backup.");
    }
  }
  return (
    <>
      <Header />
      <main className="library-main">
        <div className="library-heading">
          <div>
            <h1>Good things, kept close.</h1>
            <p>
              Your little collection of creations. Saved right here, on this
              device.
            </p>
          </div>
          <Link className="primary" href="/create">
            <Plus size={18} />
            New creation
          </Link>
        </div>
        {error ? (
          <p className="error-copy" role="alert">
            {error}
          </p>
        ) : null}
        {projects === null ? (
          <p className="loading-copy">Finding your little things…</p>
        ) : projects.length ? (
          <div className="preset-grid">
            {projects.map((p) => (
              <article className="preset-card" key={p.id}>
                <Link
                  href={`/create/${p.id}`}
                  className="preset-picture"
                  style={{ background: "#edf0e3" }}
                >
                  <BeadArt cells={p.cells} width={p.width} name={p.name} />
                </Link>
                <div className="preset-info">
                  <h2>{p.name}</h2>
                  <p>
                    {p.cells.filter(Boolean).length} beads · {p.width} ×{" "}
                    {p.height} board
                    <br />
                    Saved{" "}
                    {new Date(p.updatedAt).toLocaleDateString("en-SG", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                  <div className="project-card-actions">
                    <Link className="secondary" href={`/create/${p.id}`}>
                      Keep creating
                    </Link>
                    <div>
                      <button
                        className="icon-button"
                        title="Duplicate project"
                        aria-label={`Duplicate ${p.name}`}
                        onClick={() => duplicate(p)}
                      >
                        <Copy size={15} />
                      </button>
                      <button
                        className="icon-button"
                        title="Export project"
                        aria-label={`Export ${p.name}`}
                        onClick={() => exportProject(p)}
                      >
                        <Download size={15} />
                      </button>
                      <button
                        className="icon-button"
                        title="Delete project"
                        aria-label={`Delete ${p.name}`}
                        onClick={() => setRemove(p)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-library">
            <h2>Nothing here yet.</h2>
            <p>
              That’s just another way of saying: room for something wonderful.
            </p>
            <Link className="primary" href="/create">
              Create your first design
            </Link>
          </div>
        )}
      </main>
      {remove ? (
        <Modal title="Let this little one go?" onClose={() => setRemove(null)}>
          <p className="modal-description">
            Delete “{remove.name}” from this browser? Export a backup first if
            you’d like to keep it.
          </p>
          <div className="dialog-actions">
            <button className="secondary" onClick={() => exportProject(remove)}>
              Export backup
            </button>
            <button
              className="primary"
              onClick={() => {
                try {
                  deleteProject(remove.id);
                  setProjects(readProjects());
                  setRemove(null);
                } catch {
                  setError("This project could not be deleted.");
                }
              }}
            >
              Delete project
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
