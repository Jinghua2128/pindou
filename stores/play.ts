import { newId } from "@/lib/id";
import { create } from "zustand";
import { initialToys, type Presence, type Toy } from "@/lib/co-op";
import { useEditor } from "@/stores/editor";

type Held = {
  color: string;
  source?: number;
  looseId?: string;
  start?: { x: number; y: number };
};
type PlayState = {
  draggingTray: boolean;
  entryRoom: string | null;
  playerName: string;
  toys: Toy[];
  held: Held | null;
  hover: number | null;
  peers: Presence[];
  status: string;
  connected: boolean;
  hydrated: boolean;
  notice: string;
  pick: (bead: Held) => void;
  place: (index: number) => void;
  moveToy: (id: string, x: number, y: number) => void;
  spill: (id: string) => void;
  tidy: () => void;
};
export const usePlay = create<PlayState>((set, get) => ({
  draggingTray: false,
  entryRoom: null,
  playerName: "Little maker",
  toys: initialToys(),
  held: null,
  hover: null,
  peers: [],
  status: "Connecting…",
  connected: false,
  hydrated: false,
  notice: "",
  pick: (held) => {
    const s = useEditor.getState();
    if (s.fused || s.fusing) return;
    s.end();
    s.setTool("grab");
    s.setColor(held.color);
    set({ held });
  },
  place: (index) => {
    const { held, toys } = get(),
      s = useEditor.getState();
    if (
      !held ||
      s.fused ||
      s.fusing ||
      index < 0 ||
      index >= s.project.cells.length
    )
      return;
    if (
      (held.source !== undefined &&
        s.project.cells[held.source] !== held.color) ||
      (held.looseId && !toys.some((t) => t.id === held.looseId))
    ) {
      set({
        held: null,
        notice: "Your friend moved that bead. Pick another little one.",
      });
      return;
    }
    s.putBead(index, held.color, held.source);
    set({
      held: null,
      toys: held.looseId ? toys.filter((t) => t.id !== held.looseId) : toys,
      notice: "Bead placed. A perfect little click.",
    });
  },
  moveToy: (id, x, y) =>
    set((s) => ({
      toys: s.toys.map((t) =>
        t.id === id
          ? {
              ...t,
              x: Math.max(10, Math.min(90, x)),
              y: Math.max(20, Math.min(78, y)),
            }
          : t,
      ),
    })),
  spill: (id) => {
    const { toys } = get(),
      tray = toys.find((t) => t.id === id);
    if (!tray || toys.length > 68) {
      set({ notice: "A very full table! Tidy a little before spilling more." });
      return;
    }
    const beads: Toy[] = Array.from({ length: 10 }, (_, i) => ({
      id: newId(),
      kind: "bead",
      color: tray.color,
      x: Math.max(4, Math.min(96, tray.x + Math.sin(i * 2.4) * (12 + i))),
      y: Math.max(12, Math.min(90, tray.y + 20 + Math.cos(i * 2.4) * 18)),
      angle: (i * 47) % 180,
    }));
    set({
      toys: [
        ...toys.map((t) =>
          t.id === id ? { ...t, angle: t.angle > 10 ? -5 : 22 } : t,
        ),
        ...beads,
      ],
      notice: "Oops. Pick up the scattered beads or keep making a mess.",
    });
  },
  tidy: () =>
    set({ toys: initialToys(), notice: "Everything back in its little box." }),
}));
