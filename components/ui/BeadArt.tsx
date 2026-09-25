import { COLOR_MAP } from "@/lib/colors";
import type { Cell } from "@/types/project";
export function BeadArt({
  cells,
  width,
  name,
  className = "",
}: {
  cells: Cell[];
  width: number;
  name: string;
  className?: string;
}) {
  const occupied = cells.flatMap((c, i) => (c ? [i] : []));
  const xs = occupied.map((i) => i % width),
    ys = occupied.map((i) => Math.floor(i / width));
  const minX = Math.min(...xs) - 1,
    minY = Math.min(...ys) - 1,
    maxX = Math.max(...xs) + 1,
    maxY = Math.max(...ys) + 1;
  return (
    <svg
      viewBox={
        occupied.length
          ? `${minX} ${minY} ${maxX - minX + 1} ${maxY - minY + 1}`
          : `0 0 ${width} ${width}`
      }
      className={`bead-art ${className}`}
      role="img"
      aria-label={name}
    >
      {occupied.map((i) => (
        <g
          key={i}
          transform={`translate(${(i % width) + 0.5} ${Math.floor(i / width) + 0.5})`}
        >
          <circle cy={0.11} r={0.47} fill="#152b24" opacity={0.16} />
          <circle r={0.46} fill={COLOR_MAP[cells[i]!]?.hex} />
          <path
            d="M-.35 0 A.35 .35 0 0 1 .35 0"
            stroke="white"
            opacity={0.4}
            strokeWidth={0.09}
            fill="none"
          />
          <circle r={0.17} fill="#203027" opacity={0.47} />
          <path
            d="M-.17 0 A.17 .17 0 0 0 .17 0"
            stroke="white"
            opacity={0.5}
            strokeWidth={0.06}
            fill="none"
          />
        </g>
      ))}
    </svg>
  );
}
