import { create } from "zustand";
import type {
  BeadProject,
  CameraMode,
  Cell,
  MotionMode,
  Patch,
  Selection,
  Tool,
} from "@/types/project";
import {
  applyPatches,
  diff,
  floodIndices,
  lineIndices,
  rectangleIndices,
  selectionIndices,
} from "@/lib/grid";
import { availableHistory } from "@/lib/co-op";
import { initialProject } from "@/lib/presets";
type EditorState = {
  project: BeadProject;
  tool: Tool;
  color: string;
  recent: string[];
  mirror: boolean;
  camera: CameraMode;
  cameraRevision: number;
  zoom: number;
  motion: MotionMode;
  sound: boolean;
  grid: boolean;
  fused: boolean;
  fusing: boolean;
  selection: Selection | null;
  past: Patch[][];
  future: Patch[][];
  strokeBefore: Cell[] | null;
  strokeStart: number | null;
  strokeLast: number | null;
  revision: number;
  notice: string;
  load: (project: BeadProject) => void;
  rename: (name: string) => void;
  setTool: (tool: Tool) => void;
  setColor: (color: string) => void;
  setCamera: (mode: CameraMode) => void;
  setZoom: (zoom: number) => void;
  setMotion: (motion: MotionMode) => void;
  begin: (index: number, erase?: boolean) => void;
  draw: (index: number, erase?: boolean) => void;
  end: () => void;
  cancelStroke: () => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  moveSelection: (dx: number, dy: number) => void;
  putBead: (index: number, color: string, source?: number) => void;
  replaceColor: (old: string, next: string) => void;
};
function changed(project: BeadProject, cells: Cell[]): BeadProject {
  return { ...project, cells, updatedAt: new Date().toISOString() };
}
export const useEditor = create<EditorState>((set, get) => ({
  project: initialProject(),
  tool: "pencil",
  color: "green",
  recent: ["green", "lime", "pink", "white", "black"],
  mirror: false,
  camera: "iso",
  cameraRevision: 0,
  zoom: 100,
  motion: "full",
  sound: false,
  grid: true,
  fused: false,
  fusing: false,
  selection: null,
  past: [],
  future: [],
  strokeBefore: null,
  strokeStart: null,
  strokeLast: null,
  revision: 0,
  notice: "",
  load: (project) =>
    set({
      project,
      past: [],
      future: [],
      strokeBefore: null,
      strokeStart: null,
      strokeLast: null,
      selection: null,
      fused: false,
      fusing: false,
      tool: "pencil",
      zoom: 100,
      cameraRevision: get().cameraRevision + 1,
      revision: get().revision + 1,
    }),
  rename: (name) =>
    set((s) => ({
      project: {
        ...s.project,
        name: name.trim().slice(0, 80) || "Untitled creation",
        updatedAt: new Date().toISOString(),
      },
      revision: s.revision + 1,
    })),
  setTool: (tool) => {
    get().end();
    set({ tool, selection: null });
  },
  setColor: (color) =>
    set((s) => ({
      color,
      recent: [color, ...s.recent.filter((c) => c !== color)].slice(0, 6),
    })),
  setCamera: (camera) =>
    set((s) => ({ camera, cameraRevision: s.cameraRevision + 1 })),
  setZoom: (zoom) => set({ zoom: Math.min(180, Math.max(50, zoom)) }),
  setMotion: (motion) => set({ motion }),
  begin: (index, erase = false) => {
    const s = get();
    if (
      s.fusing ||
      s.fused ||
      index < 0 ||
      index >= s.project.cells.length ||
      s.tool === "hand" ||
      s.tool === "grab"
    )
      return;
    s.end();
    if (s.tool === "eyedropper" && !erase) {
      const color = s.project.cells[index];
      if (color) s.setColor(color);
      return;
    }
    set({
      strokeBefore: [...s.project.cells],
      strokeStart: index,
      strokeLast: index,
    });
    get().draw(index, erase);
  },
  draw: (index, erase = false) => {
    const s = get();
    if (!s.strokeBefore || index < 0 || index >= s.project.cells.length) return;
    const { width, height } = s.project;
    let indices: number[] = [];
    const start = s.strokeStart!;
    if (s.tool === "select" && !erase) {
      set({
        selection: {
          x1: start % width,
          y1: Math.floor(start / width),
          x2: index % width,
          y2: Math.floor(index / width),
        },
      });
      return;
    }
    if (s.tool === "fill" && !erase)
      indices = floodIndices(s.project.cells, index, width, height);
    else if (s.tool === "line" && !erase)
      indices = lineIndices(start, index, width);
    else if (s.tool === "rectangle" && !erase)
      indices = rectangleIndices(start, index, width);
    else indices = lineIndices(s.strokeLast ?? index, index, width);
    const cells = [
        ...((s.tool === "line" || s.tool === "rectangle") && !erase
          ? s.strokeBefore
          : s.project.cells),
      ],
      color = erase || s.tool === "eraser" ? null : s.color;
    for (const i of indices) {
      cells[i] = color;
      if (s.mirror)
        cells[Math.floor(i / width) * width + (width - 1 - (i % width))] =
          color;
    }
    set({ project: changed(s.project, cells), strokeLast: index });
  },
  end: () => {
    const s = get();
    if (!s.strokeBefore) return;
    const patches = diff(s.strokeBefore, s.project.cells);
    set({
      strokeBefore: null,
      strokeStart: null,
      strokeLast: null,
      ...(patches.length
        ? {
            past: [...s.past, patches].slice(-100),
            future: [],
            revision: s.revision + 1,
          }
        : {}),
    });
  },
  cancelStroke: () => {
    const s = get();
    if (!s.strokeBefore) return;
    set({
      project: { ...s.project, cells: s.strokeBefore },
      strokeBefore: null,
      strokeStart: null,
      strokeLast: null,
      selection: null,
    });
  },
  undo: () => {
    get().end();
    const s = get(),
      patch = s.past.at(-1);
    if (!patch) return;
    set({
      project: changed(
        s.project,
        applyPatches(
          s.project.cells,
          availableHistory(s.project.cells, patch, "before"),
          "before",
        ),
      ),
      past: s.past.slice(0, -1),
      future: [...s.future, availableHistory(s.project.cells, patch, "before")],
      revision: s.revision + 1,
      fused: false,
    });
  },
  redo: () => {
    get().end();
    const s = get(),
      patch = s.future.at(-1);
    if (!patch) return;
    set({
      project: changed(
        s.project,
        applyPatches(
          s.project.cells,
          availableHistory(s.project.cells, patch, "after"),
          "after",
        ),
      ),
      past: [...s.past, availableHistory(s.project.cells, patch, "after")],
      future: s.future.slice(0, -1),
      revision: s.revision + 1,
    });
  },
  clear: () => {
    const s = get();
    const cells: Cell[] = Array(s.project.cells.length).fill(null),
      patches = diff(s.project.cells, cells);
    if (!patches.length) return;
    set({
      project: changed(s.project, cells),
      past: [...s.past, patches].slice(-100),
      future: [],
      revision: s.revision + 1,
      fused: false,
      selection: null,
    });
  },
  moveSelection: (dx, dy) => {
    const s = get();
    if (!s.selection || s.fused) return;
    const { width, height, cells } = s.project,
      indices = selectionIndices(s.selection, width);
    if (
      indices.some(
        (i) =>
          (i % width) + dx < 0 ||
          (i % width) + dx >= width ||
          Math.floor(i / width) + dy < 0 ||
          Math.floor(i / width) + dy >= height,
      )
    )
      return;
    const next = [...cells];
    for (const i of indices) next[i] = null;
    for (const i of indices) next[i + dy * width + dx] = cells[i];
    const patches = diff(cells, next);
    set({
      project: changed(s.project, next),
      selection: {
        x1: s.selection.x1 + dx,
        x2: s.selection.x2 + dx,
        y1: s.selection.y1 + dy,
        y2: s.selection.y2 + dy,
      },
      past: patches.length ? [...s.past, patches].slice(-100) : s.past,
      future: [],
      revision: s.revision + 1,
    });
  },
  putBead: (index, color, source) => {
    get().end();
    const s = get();
    if (s.fused || s.fusing || index < 0 || index >= s.project.cells.length)
      return;
    const cells = [...s.project.cells];
    if (source !== undefined) cells[source] = cells[index];
    cells[index] = color;
    const patches = diff(s.project.cells, cells);
    if (!patches.length) return;
    set({
      project: changed(s.project, cells),
      past: [...s.past, patches].slice(-100),
      future: [],
      revision: s.revision + 1,
    });
  },
  replaceColor: (old, next) => {
    const s = get();
    const cells = s.project.cells.map((c) => (c === old ? next : c)),
      patches = diff(s.project.cells, cells);
    if (!patches.length) return;
    set({
      project: changed(s.project, cells),
      past: [...s.past, patches].slice(-100),
      future: [],
      revision: s.revision + 1,
    });
  },
}));
