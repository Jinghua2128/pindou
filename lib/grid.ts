import type { Cell, Patch, Selection } from "@/types/project";
export function lineIndices(
  start: number,
  end: number,
  width: number,
): number[] {
  let x = start % width,
    y = Math.floor(start / width);
  const x2 = end % width,
    y2 = Math.floor(end / width),
    dx = Math.abs(x2 - x),
    dy = -Math.abs(y2 - y),
    sx = x < x2 ? 1 : -1,
    sy = y < y2 ? 1 : -1;
  let error = dx + dy;
  const result: number[] = [];
  for (;;) {
    result.push(y * width + x);
    if (x === x2 && y === y2) break;
    const e = 2 * error;
    if (e >= dy) {
      error += dy;
      x += sx;
    }
    if (e <= dx) {
      error += dx;
      y += sy;
    }
  }
  return result;
}
export function rectangleIndices(
  start: number,
  end: number,
  width: number,
): number[] {
  const x1 = Math.min(start % width, end % width),
    x2 = Math.max(start % width, end % width),
    y1 = Math.min(Math.floor(start / width), Math.floor(end / width)),
    y2 = Math.max(Math.floor(start / width), Math.floor(end / width));
  const indices = new Set<number>();
  for (let x = x1; x <= x2; x++) {
    indices.add(y1 * width + x);
    indices.add(y2 * width + x);
  }
  for (let y = y1; y <= y2; y++) {
    indices.add(y * width + x1);
    indices.add(y * width + x2);
  }
  return [...indices];
}
export function neighbors(
  index: number,
  width: number,
  height: number,
): number[] {
  const x = index % width,
    y = Math.floor(index / width),
    result = [];
  if (x > 0) result.push(index - 1);
  if (x < width - 1) result.push(index + 1);
  if (y > 0) result.push(index - width);
  if (y < height - 1) result.push(index + width);
  return result;
}
export function floodIndices(
  cells: Cell[],
  start: number,
  width: number,
  height: number,
): number[] {
  if (start < 0 || start >= cells.length) return [];
  const color = cells[start],
    visited = new Set([start]),
    queue = [start];
  for (let head = 0; head < queue.length; head++) {
    for (const n of neighbors(queue[head], width, height)) {
      if (!visited.has(n) && cells[n] === color) {
        visited.add(n);
        queue.push(n);
      }
    }
  }
  return queue;
}
export function diff(before: Cell[], after: Cell[]): Patch[] {
  return before.flatMap((cell, index) =>
    cell !== after[index] ? [{ index, before: cell, after: after[index] }] : [],
  );
}
export function applyPatches(
  cells: Cell[],
  patches: Patch[],
  direction: "before" | "after",
): Cell[] {
  const next = [...cells];
  for (const patch of patches) next[patch.index] = patch[direction];
  return next;
}
export function selectionIndices(s: Selection, width: number): number[] {
  const result = [];
  for (let y = Math.min(s.y1, s.y2); y <= Math.max(s.y1, s.y2); y++)
    for (let x = Math.min(s.x1, s.x2); x <= Math.max(s.x1, s.x2); x++)
      result.push(y * width + x);
  return result;
}
export function billOfMaterials(
  cells: Cell[],
): { colorId: string; quantity: number; percentage: number }[] {
  const counts = new Map<string, number>();
  let total = 0;
  for (const cell of cells)
    if (cell) {
      counts.set(cell, (counts.get(cell) || 0) + 1);
      total++;
    }
  return [...counts]
    .map(([colorId, quantity]) => ({
      colorId,
      quantity,
      percentage: (quantity / total) * 100,
    }))
    .sort((a, b) => b.quantity - a.quantity);
}
export function structuralCheck(cells: Cell[], width: number, height: number) {
  const visited = new Set<number>(),
    groups: number[][] = [];
  for (let i = 0; i < cells.length; i++) {
    if (!cells[i] || visited.has(i)) continue;
    const group = [i];
    visited.add(i);
    for (let k = 0; k < group.length; k++)
      for (const n of neighbors(group[k], width, height))
        if (cells[n] && !visited.has(n)) {
          visited.add(n);
          group.push(n);
        }
    groups.push(group);
  }
  const fragile = cells.flatMap((cell, i) =>
    cell && neighbors(i, width, height).filter((n) => cells[n]).length === 1
      ? [i]
      : [],
  );
  return { groups, fragile };
}
