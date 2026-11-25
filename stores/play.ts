import { create } from "zustand";
import {
  initialToys,
  spillToys,
  boxFits,
  MAX_BOXES,
  type Presence,
  type Toy,
} from "@/lib/co-op";
import { useEditor } from "@/stores/editor";

type Held = {
  color: string;
  source?: number;
  looseId?: string;
  trayId?: string;
  start?: { x: number; y: number; pointerId?: number; dropOnTap?: boolean };
};
export function beadAvailable(
  held: Held,
  cells: (string | null)[],
  toys: Toy[],
) {
  return (
    (held.source === undefined || cells[held.source] === held.color) &&
    (!held.looseId || toys.some((t) => t.id === held.looseId))
  );
}
type PlayState = {
  draggingTray: string | null;
  position: Presence["position"];
  stockColor: (color: string) => void;
  addBox: (color: string) => boolean;
  putAway: (id: string) => void;
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
  spill: (id: string, direction: { x: number; z: number }) => void;
  tidy: () => void;
};
export const usePlay = create<PlayState>((set, get) => ({
  draggingTray: null,
  position: null,
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
  stockColor: (color) => {
    // Keep two boxes available while the third can be stocked from the full palette.
    const { toys } = get();
    if (toys.some((t) => t.kind === "tray" && t.color === color)) return;
    set({ toys: toys.map((t) => (t.id === "tray-2" ? { ...t, color } : t)) });
  },
  addBox: (color) => {
    const { toys } = get(),
      boxes = toys.filter((t) => t.kind === "tray");
    if (boxes.length >= MAX_BOXES || toys.length >= 80) return false;
    const slots = [50, 20, 80];
    const slot = slots.findIndex(
      (_, i) => !boxes.some((t) => t.id === `tray-${i + 3}`),
    );
    if (slot < 0) return false;
    const tray: Toy = {
      id: `tray-${slot + 3}`,
      kind: "tray",
      color,
      x: slots[slot],
      y: 30,
      angle: 0,
      side: "back",
    };
    // Usually a free spot exists even after the other boxes have been moved.
    for (const y of [30, 74, 22, 78]) {
      for (const x of [slots[slot], ...slots, 12, 88]) {
        if (!boxFits(toys, tray, x, y)) continue;
        set({
          toys: [...toys, { ...tray, x, y }],
          notice: "Box added to the far side of the board.",
        });
        return true;
      }
    }
    set({ notice: "Make room on the far side or tidy the table." });
    return false;
  },
  putAway: (id) =>
    set((s) => ({
      toys: s.toys.filter(
        (t) => !(t.id === id && t.kind === "tray" && t.side === "back"),
      ),
      notice: "Box put away.",
    })),
  pick: (held) => {
    const s = useEditor.getState();
    if (s.fused || s.fusing) return;
    if (
      get().peers.some(
        (p) =>
          (held.looseId && held.looseId === p.looseId) ||
          (held.source !== undefined && held.source === p.source),
      )
    ) {
      set({ notice: "Another maker is holding that bead." });
      return;
    }
    if (s.placement === "interactive") s.setTool("grab");
    else if (s.tool === "hand") s.setTool("pencil");
    else s.end();
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
    if (!beadAvailable(held, s.project.cells, toys)) {
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
    set((s) => {
      const tray = s.toys.find((t) => t.id === id && t.kind === "tray");
      if (!tray) return s;
      x = Math.max(12, Math.min(88, x));
      y = Math.max(22, Math.min(78, y));
      // Slide against the nearest rim instead of jumping through a neighbor on a large pointer step.
      const neighbors = s.toys.filter(
        (t) => t.kind === "tray" && t.side === tray.side && t.id !== id,
      );
      for (const other of neighbors) {
        if (Math.abs(other.y - tray.y) >= 40) continue;
        x =
          other.x > tray.x
            ? Math.min(x, other.x - 24)
            : Math.max(x, other.x + 24);
      }
      for (const other of neighbors) {
        if (Math.abs(other.x - x) >= 24) continue;
        y =
          other.y > tray.y
            ? Math.min(y, other.y - 40)
            : Math.max(y, other.y + 40);
      }
      x = Math.max(12, Math.min(88, x));
      y = Math.max(22, Math.min(78, y));
      if (x === tray.x && y === tray.y) return s;
      return { toys: s.toys.map((t) => (t.id === id ? { ...t, x, y } : t)) };
    }),
  spill: (id, direction) => {
    const toys = get().toys;
    const spilled = spillToys(toys, id, direction);
    set({
      toys: spilled,
      notice:
        spilled === toys
          ? "Tidy the table before spilling more."
          : "Beads spilled. Pick one up or tidy the table.",
    });
  },
  tidy: () =>
    set((s) => ({
      toys: s.toys
        .filter((t) => t.kind === "tray")
        .map((t) => {
          const i = Number(t.id.split("-")[1]);
          const x = t.side === "back" ? [50, 20, 80][i - 3] : [20, 50, 80][i];
          return { ...t, x: x ?? t.x, y: 30, angle: 0 };
        }),
      held: s.held?.looseId ? null : s.held,
      notice: "Everything back in its little box.",
    })),
}));
