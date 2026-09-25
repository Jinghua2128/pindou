import { COLORS } from "./colors";
import type { Cell } from "@/types/project";
function lab(r: number, g: number, b: number) {
  const linear = (v: number) => {
    v /= 255;
    return v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92;
  };
  r = linear(r);
  g = linear(g);
  b = linear(b);
  const f = (v: number) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  const x = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047),
    y = f(0.2126 * r + 0.7152 * g + 0.0722 * b),
    z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
const palette = COLORS.map((c) => {
  const r = parseInt(c.hex.slice(1, 3), 16),
    g = parseInt(c.hex.slice(3, 5), 16),
    b = parseInt(c.hex.slice(5, 7), 16);
  return { ...c, lab: lab(r, g, b) };
});
export function convertPixels(
  data: Uint8ClampedArray,
  limit: number,
  removeWhite: boolean,
  contrast: number,
): Cell[] {
  const values = Array.from({ length: data.length / 4 }, (_, i) => {
    const r = data[i * 4],
      g = data[i * 4 + 1],
      b = data[i * 4 + 2];
    return data[i * 4 + 3] < 80 ||
      (removeWhite && r > 235 && g > 235 && b > 235)
      ? null
      : lab(
          ...([r, g, b].map((v) =>
            Math.max(0, Math.min(255, (v - 128) * contrast + 128)),
          ) as [number, number, number]),
        );
  });
  const nearest = (v: number[], colors: typeof palette) =>
    colors.reduce(
      (best, c) => {
        const dist = c.lab.reduce((d, x, i) => d + (x - v[i]) ** 2, 0);
        return dist < best.distance ? { id: c.id, distance: dist } : best;
      },
      { id: colors[0].id, distance: Infinity },
    ).id;
  const counts = new Map<string, number>();
  for (const v of values)
    if (v) {
      const id = nearest(v, palette);
      counts.set(id, (counts.get(id) || 0) + 1);
    }
  const allowed = [...counts]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => palette.find((c) => c.id === id)!);
  return values.map((v) => (v && allowed.length ? nearest(v, allowed) : null));
}
