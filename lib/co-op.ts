import { z } from "zod";
import { newId } from "@/lib/id";
import { COLORS } from "@/lib/colors";
import { projectSchema, type BeadProject, type Patch } from "@/types/project";

const color = z.string().refine((id) => COLORS.some((c) => c.id === id));
export const toySchema = z.object({
  id: z.string().min(1).max(80),
  kind: z.enum(["tray", "bead"]),
  color,
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  angle: z.number().min(-180).max(180),
  side: z.literal("back").optional(),
  origin: z
    .object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) })
    .optional(),
});
export type Toy = z.infer<typeof toySchema>;
export const MAX_BOXES = 6;
export const initialToys = (): Toy[] =>
  ["green", "pink", "yellow"].map((color, i) => ({
    id: `tray-${i}`,
    kind: "tray",
    color,
    x: 20 + i * 30,
    y: 30,
    angle: i * 5 - 5,
  }));
// Tray and loose-bead positions are percentages of the strip in front of the board.
// Presence uses peg-sized world units, independent of each player's camera.
export function tableLayout(width: number, height: number) {
  const span = Math.max(18, width + 1);
  const depth = Math.max(8, span * 0.35);
  return { span, depth, back: height / 2 + 1.1 };
}
export function toyPosition(toy: Toy, width: number, height: number) {
  const { span, depth, back } = tableLayout(width, height);
  return {
    x: (toy.x / 100 - 0.5) * span,
    z: (toy.side === "back" ? -1 : 1) * (back + (toy.y / 100) * depth),
  };
}
export type TraySample = { x: number; z: number; time: number };
// Coordinates are fractions of table width so a flick feels the same at any zoom.
export function swingDirection(samples: TraySample[], now: TraySample) {
  while (samples.length && now.time - samples[0].time > 140) samples.shift();
  samples.push(now);
  for (const from of samples) {
    const dx = now.x - from.x,
      dz = now.z - from.z,
      distance = Math.hypot(dx, dz);
    if (
      distance >= 0.05 &&
      distance / Math.max(12, now.time - from.time) >= 0.00085
    )
      return { x: dx / distance, z: dz / distance };
  }
  return null;
}
export function boxFits(toys: Toy[], tray: Toy, x: number, y: number) {
  return !toys.some(
    (t) =>
      t.kind === "tray" &&
      t.id !== tray.id &&
      t.side === tray.side &&
      Math.abs(t.x - x) < 24 - 1e-6 &&
      Math.abs(t.y - y) < 40 - 1e-6,
  );
}
export function spillToys(
  toys: Toy[],
  trayId: string,
  direction?: { x: number; z: number },
) {
  const tray = toys.find((t) => t.id === trayId && t.kind === "tray");
  const count = direction ? 5 : 10;
  if (!tray || toys.length + count > 80) return toys;
  const heading = direction
    ? Math.atan2(direction.z * (tray.side ? -1 : 1), direction.x)
    : Math.PI / 2;
  const beads: Toy[] = Array.from({ length: count }, (_, i) => {
    const angle = heading + (((i * 0.618) % 1) - 0.5) * 2.35;
    const range = 15 + ((i * 7) % 14);
    const x = Math.max(3, Math.min(97, tray.x + Math.cos(angle) * range));
    let y = Math.max(5, Math.min(95, tray.y + Math.sin(angle) * range * 2));
    // Land clear of the rim even when a throw reaches the table edge.
    for (const box of toys) {
      if (
        box.kind === "tray" &&
        box.side === tray.side &&
        Math.abs(x - box.x) < 14 &&
        Math.abs(y - box.y) < 24
      )
        y = box.y < 50 ? box.y + 25 : box.y - 25;
    }
    return {
      id: newId(),
      kind: "bead",
      color: tray.color,
      x,
      y,
      angle: (i * 47) % 180,
      ...(tray.side ? { side: tray.side } : {}),
      origin: { x: tray.x, y: tray.y },
    };
  });
  return [
    ...toys.map((t) =>
      t.id === tray.id ? { ...t, angle: t.angle > 7 ? -7 : 10 } : t,
    ),
    ...beads,
  ];
}
export const operationSchema = z.object({
  seq: z.number().int().positive(),
  cells: z
    .array(
      z.object({
        index: z.number().int().min(0).max(4095),
        before: color.nullable(),
        after: color.nullable(),
      }),
    )
    .max(4096),
  toys: z
    .array(
      z.object({
        id: z.string().max(80),
        before: toySchema.nullable(),
        after: toySchema.nullable(),
      }),
    )
    .max(100),
  name: z
    .object({ before: z.string().max(80), after: z.string().min(1).max(80) })
    .optional(),
});
export type Operation = z.infer<typeof operationSchema>;
export const presenceSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(24),
  cell: z.number().int().min(0).max(4095).nullable(),
  holding: color.nullable(),
  position: z
    .object({
      x: z.number().min(-150).max(150),
      z: z.number().min(-150).max(150),
    })
    .nullable()
    .optional(),
  tray: z.string().max(80).nullable().optional(),
  looseId: z.string().max(80).optional(),
  source: z.number().int().min(0).max(4095).optional(),
});
export type Presence = z.infer<typeof presenceSchema>;
export const syncSchema = z.object({
  peer: presenceSchema,
  since: z.number().int().nonnegative().optional(),
  operations: z.array(operationSchema).max(32),
});
export const createRoomSchema = z.object({
  project: projectSchema,
  toys: z
    .array(toySchema)
    .max(80)
    .refine(
      (toys) => toys.filter((t) => t.kind === "tray").length <= MAX_BOXES,
    ),
});
export type RoomSnapshot = {
  version: number;
  project: BeadProject;
  toys: Toy[];
  peers: Presence[];
  rejected: number[];
};
export type RoomSyncResponse =
  | RoomSnapshot
  | (Pick<RoomSnapshot, "version" | "peers" | "rejected"> & {
      unchanged: true;
    });
export function toyDiff(before: Toy[], after: Toy[]): Operation["toys"] {
  const ids = new Set([...before, ...after].map((t) => t.id));
  return [...ids].flatMap((id) => {
    const a = before.find((t) => t.id === id) ?? null,
      b = after.find((t) => t.id === id) ?? null;
    return sameToy(a, b) ? [] : [{ id, before: a, after: b }];
  });
}
export function sameToy(a: Toy | null, b: Toy | null) {
  return JSON.stringify(a) === JSON.stringify(b);
}
/** One gesture commits atomically: a stale move can never duplicate or lose a bead. */
export function applyOperation(
  project: BeadProject,
  toys: Toy[],
  op: Operation,
  conditional = true,
) {
  if (
    conditional &&
    (op.cells.some(
      (p) =>
        p.index >= project.cells.length || project.cells[p.index] !== p.before,
    ) ||
      op.toys.some(
        (p) => !sameToy(toys.find((t) => t.id === p.id) ?? null, p.before),
      ) ||
      (op.name && project.name !== op.name.before))
  )
    return null;
  if (
    new Set(op.cells.map((p) => p.index)).size !== op.cells.length ||
    new Set(op.toys.map((p) => p.id)).size !== op.toys.length
  )
    return null;
  const cells = [...project.cells];
  for (const p of op.cells) {
    if (p.index >= cells.length) return null;
    cells[p.index] = p.after;
  }
  let nextToys = [...toys];
  for (const p of op.toys) {
    if (p.after && p.after.id !== p.id) return null;
    nextToys = nextToys.filter((t) => t.id !== p.id);
    if (p.after) nextToys.push(p.after);
  }
  if (nextToys.length > 80) return null;
  if (
    conditional &&
    op.toys.some(
      (t) => t.after?.kind === "tray" && t.before?.kind !== "tray",
    ) &&
    nextToys.filter((t) => t.kind === "tray").length > MAX_BOXES
  )
    return null;
  // Concurrent moves of different boxes still need to respect the same physical space.
  if (
    conditional &&
    op.toys.some(
      ({ before, after }) =>
        after?.kind === "tray" &&
        (!before ||
          before.x !== after.x ||
          before.y !== after.y ||
          before.side !== after.side) &&
        !boxFits(nextToys, after, after.x, after.y),
    )
  )
    return null;
  return {
    project: {
      ...project,
      cells,
      name: op.name?.after ?? project.name,
      updatedAt: new Date().toISOString(),
    },
    toys: nextToys,
  };
}
export function availableHistory(
  cells: BeadProject["cells"],
  patches: Patch[],
  direction: "before" | "after",
) {
  return patches.every(
    (p) => cells[p.index] === p[direction === "before" ? "after" : "before"],
  )
    ? patches
    : [];
}
