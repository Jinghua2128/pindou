"use client";
import {
  Pencil,
  Grab,
  Eraser,
  Pipette,
  PaintBucket,
  Slash,
  Square,
  FlipHorizontal2,
  Scan,
  Hand,
  Trash2,
} from "lucide-react";
import { useEditor } from "@/stores/editor";
import { animatePress } from "@/lib/motion";
import type { Tool } from "@/types/project";
const tools: {
  id: Tool;
  label: string;
  shortcut: string;
  icon: typeof Pencil;
}[] = [
  { id: "grab", label: "Grab bead", shortcut: "G", icon: Grab },
  { id: "pencil", label: "Pencil", shortcut: "B", icon: Pencil },
  { id: "eraser", label: "Eraser", shortcut: "E", icon: Eraser },
  { id: "fill", label: "Fill", shortcut: "F", icon: PaintBucket },
  { id: "eyedropper", label: "Eyedropper", shortcut: "I", icon: Pipette },
  { id: "line", label: "Line", shortcut: "L", icon: Slash },
  { id: "rectangle", label: "Rectangle", shortcut: "R", icon: Square },
  { id: "select", label: "Select", shortcut: "V", icon: Scan },
  { id: "hand", label: "Pan / orbit", shortcut: "H", icon: Hand },
];
export function Toolbar({ onClear }: { onClear: () => void }) {
  const tool = useEditor((s) => s.tool),
    setTool = useEditor((s) => s.setTool),
    mirror = useEditor((s) => s.mirror),
    fused = useEditor((s) => s.fused);
  return (
    <div className="tool-rail" aria-label="Drawing tools">
      {tools.map(({ id, label, shortcut, icon: Icon }) => (
        <button
          key={id}
          className={`tool-button ${tool === id ? "selected" : ""}`}
          title={`${label} (${shortcut})`}
          aria-label={`${label} (${shortcut})`}
          aria-pressed={tool === id}
          disabled={fused && id !== "hand"}
          onClick={(e) => {
            setTool(id);
            animatePress(e.currentTarget);
          }}
        >
          <Icon size={21} />
          <span>{label === "Pan / orbit" ? "Move" : label}</span>
        </button>
      ))}
      <span className="tool-divider" />
      <button
        className={`tool-button ${mirror ? "selected" : ""}`}
        title="Mirror (M)"
        aria-label="Mirror (M)"
        aria-pressed={mirror}
        onClick={(e) => {
          useEditor.setState({ mirror: !mirror });
          animatePress(e.currentTarget);
        }}
      >
        <FlipHorizontal2 size={21} />
        <span>Mirror</span>
      </button>
      <button
        className="tool-button clear-tool"
        title="Clear board"
        aria-label="Clear board"
        onClick={onClear}
      >
        <Trash2 size={18} />
      </button>
    </div>
  );
}
