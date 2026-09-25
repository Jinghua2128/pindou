import { z } from "zod";
import { COLORS } from "@/lib/colors";
const colorIdSchema = z
  .string()
  .refine((id) => COLORS.some((c) => c.id === id));
export const projectSchema = z
  .object({
    version: z.literal(1),
    id: z.string().min(1).max(100),
    name: z.string().min(1).max(80),
    width: z.number().int().min(8).max(64),
    height: z.number().int().min(8).max(64),
    cells: z.array(colorIdSchema.nullable()).max(4096),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    presetId: z.string().optional(),
    guide: z.array(colorIdSchema.nullable()).max(4096).optional(),
  })
  .refine(
    (p) =>
      p.cells.length === p.width * p.height &&
      (!p.guide || p.guide.length === p.cells.length),
    "Grid dimensions do not match",
  );
export type BeadProject = z.infer<typeof projectSchema>;
export type Cell = string | null;
export type Tool =
  | "grab"
  | "pencil"
  | "eraser"
  | "eyedropper"
  | "fill"
  | "line"
  | "rectangle"
  | "select"
  | "hand";
export type CameraMode = "top" | "iso" | "3d";
export type MotionMode = "full" | "reduced" | "minimal";
export type Patch = { index: number; before: Cell; after: Cell };
export type Selection = { x1: number; y1: number; x2: number; y2: number };
