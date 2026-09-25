"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Grid2X2,
  ImagePlus,
  Shapes,
  Shuffle,
  Sun,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { createProject, PRESETS } from "@/lib/presets";
import { useEditor } from "@/stores/editor";
import { saveProject } from "@/lib/storage";
export function NewProject({
  onClose,
  onImage,
}: {
  onClose: () => void;
  onImage: () => void;
}) {
  const [size, setSize] = useState(29),
    [name, setName] = useState("Untitled creation");
  const router = useRouter();
  const start = (mode: "blank" | "daily" | "random") => {
    const day = Math.floor(Date.now() / 86400000);
    const preset =
      mode === "blank"
        ? undefined
        : PRESETS[
            mode === "daily"
              ? day % PRESETS.length
              : Math.floor(Math.random() * PRESETS.length)
          ];
    const p = createProject(size, preset, mode === "daily");
    if (mode === "blank") p.name = name.trim() || p.name;
    useEditor.getState().load(p);
    try {
      saveProject(p);
    } catch {}
    onClose();
    router.push(`/create/${p.id}`);
  };
  return (
    <Modal title="What will you make today?" onClose={onClose} wide>
      <p className="modal-description">
        There’s no right way to play. Just pick a place to start.
      </p>
      <div className="new-project-grid">
        <div className="blank-project">
          <Grid2X2 size={28} />
          <h3>A little blank canvas</h3>
          <p>Something entirely yours, one bead at a time.</p>
          <label>
            Project name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
            />
          </label>
          <label>Choose your board</label>
          <div className="size-options">
            {[16, 24, 29, 32, 48].map((s) => (
              <button
                key={s}
                className={size === s ? "selected" : ""}
                onClick={() => setSize(s)}
              >
                {s} × {s}
              </button>
            ))}
          </div>
          <button className="primary full" onClick={() => start("blank")}>
            Start creating <ArrowRight size={17} />
          </button>
        </div>
        <div className="other-modes">
          <button onClick={() => router.push("/presets")}>
            <Shapes />
            <span>
              <strong>Start with a template</strong>
              <small>A little inspiration goes a long way.</small>
            </span>
            <ArrowRight size={17} />
          </button>
          <button onClick={onImage}>
            <ImagePlus />
            <span>
              <strong>Image to beads</strong>
              <small>Turn your own picture into a pattern.</small>
            </span>
            <ArrowRight size={17} />
          </button>
          <button onClick={() => start("daily")}>
            <Sun />
            <span>
              <strong>Today’s tiny challenge</strong>
              <small>Slow down. Follow a pattern.</small>
            </span>
            <ArrowRight size={17} />
          </button>
          <button onClick={() => start("random")}>
            <Shuffle />
            <span>
              <strong>Surprise me</strong>
              <small>Let a little serendipity in.</small>
            </span>
            <ArrowRight size={17} />
          </button>
        </div>
      </div>
    </Modal>
  );
}
