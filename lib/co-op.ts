import { z } from "zod";
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
});
export type Toy = z.infer<typeof toySchema>;
export const initialToys = (): Toy[] =>
  ["green", "pink", "yellow"].map((color, i) => ({
    id: `tray-${i}`,
    kind: "tray",
    color,
    x: 20 + i * 30,
    y: 45,
    angle: i * 5 - 5,
  }));
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
});
export type Presence = z.infer<typeof presenceSchema>;
export const syncSchema = z.object({
  peer: presenceSchema,
  since: z.number().int().nonnegative().optional(),
  operations: z.array(operationSchema).max(32),
});
export const createRoomSchema = z.object({
  project: projectSchema,
  toys: z.array(toySchema).max(80),
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
