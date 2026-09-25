import { newId } from "@/lib/id";
import type { BeadProject, Cell } from "@/types/project";
export type Preset = {
  id: string;
  name: string;
  description: string;
  category: string;
  difficulty: "Easy" | "Medium";
  size: number;
  cells: Cell[];
  background: string;
};
function bitmap(
  rows: string[],
  map: Record<string, string>,
  size = 29,
): Cell[] {
  const cells: Cell[] = Array(size * size).fill(null),
    oy = Math.floor((size - rows.length) / 2),
    ox = Math.floor((size - Math.max(...rows.map((r) => r.length))) / 2);
  rows.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (map[c]) cells[(y + oy) * size + x + ox] = map[c];
    }),
  );
  return cells;
}
const frog = [
  "    GGG     GGG    ",
  "   GWWGG   GGWWG   ",
  "  GWWWKGG GGGKWWG  ",
  "  GWWWKGGGGGGKWWG  ",
  "  GGWWGGGGGGGWWGG  ",
  " GGGGGGGGGGGGGGGGG ",
  " GPPPGGGGGGGGGPPPG ",
  " GPPPGGGGGGGGGPPPG ",
  " GGGGGKGGGGGKGGGGG ",
  " GGGGGGKKKKKGGGGGG ",
  "  GGGGGGGGGGGGGGG  ",
  "  GGGGLLLLLLLGGGG  ",
  "  GGGLLLLLLLLLGGG  ",
  "  GGGLLLLLLLLLGGG  ",
  " GGGGLLLLLLLLLGGGG ",
  " GGGGGLLLLLLLGGGGG ",
  "GGGGGGGGGGGGGGGGGGG",
  "GGGGGGG     GGGGGGG",
  " GGGGG       GGGGG ",
];
const specs: [
  string,
  string,
  string,
  string,
  string[],
  Record<string, string>,
  string,
][] = [
  [
    "frog",
    "Pocket frog",
    "Your tiny, cheerful desk companion.",
    "Animals",
    frog,
    { G: "green", W: "white", K: "black", P: "pink", L: "lime" },
    "#e9efdc",
  ],
  [
    "cherry",
    "Cherry",
    "A classic, always a good idea.",
    "Food",
    [
      "       GGG  ",
      "      GGGGG ",
      "     GG  GG ",
      "    GG   GG ",
      "   GG    GG ",
      " RRRRR  RRRRR",
      "RRWRRRRRRWRRRR",
      "RRRRRRRRRRRRRR",
      " RRRRR  RRRRR",
      "  RRR    RRR",
    ],
    { G: "forest", R: "red", W: "coral" },
    "#f6ebe3",
  ],
  [
    "daisy",
    "Daisy",
    "Bright vibes only.",
    "Plants",
    [
      "     WWW     ",
      "    WWWWW    ",
      " WW WWWWW WW ",
      "WWWWWWYWWWWWW",
      "WWWWWYYYWWWWW",
      " WWWYYYYYWWW ",
      "WWWWWYYYWWWWW",
      "WWWWWWYWWWWWW",
      " WW WWWWW WW ",
      "    WWWWW    ",
      "     WWW     ",
    ],
    { W: "white", Y: "yellow" },
    "#f0eedf",
  ],
  [
    "heart",
    "Heart",
    "Small piece. Big feeling.",
    "Cute",
    [
      "  PPP   PPP  ",
      " PPPPP PPPPP ",
      "PPPHPPPPPHPPP",
      "PPPPPPPPPPPPP",
      "PPPPPPPPPPPPP",
      " PPPPPPPPPPP ",
      "  PPPPPPPPP  ",
      "   PPPPPPP   ",
      "    PPPPP    ",
      "     PPP     ",
      "      P      ",
    ],
    { P: "pink", H: "hotpink" },
    "#f7e7eb",
  ],
  [
    "mushroom",
    "Mushroom",
    "A little magic for your shelf.",
    "Nature",
    [
      "    RRRRR    ",
      "   RRWWRRR   ",
      "  RRRWWRRRR  ",
      " RRRRRRRWWRR ",
      "RRWWRRRRWWRRR",
      "RRWWRRRRRRRRR",
      " RRRRRRRRRRR ",
      "    CCCCC    ",
      "    CCKCC    ",
      "    CCCCC    ",
      "   CCCCCCC   ",
    ],
    { R: "red", W: "white", C: "cream", K: "brown" },
    "#f1e9dc",
  ],
  [
    "moon",
    "Sleepy moon",
    "A pocket-sized piece of night.",
    "Nature",
    [
      "    YYYY   ",
      "  YYYYY    ",
      " YYYYY     ",
      " YYYY      ",
      "YYYY       ",
      "YYYY       ",
      "YYYY       ",
      " YYYYY     ",
      "  YYYYYYYY ",
      "   YYYYYYYY",
      "     YYYY  ",
    ],
    { Y: "yellow" },
    "#ece8f4",
  ],
  [
    "flower",
    "Wildflower",
    "Grow something colorful.",
    "Plants",
    [
      "  PPP PPP  ",
      " PPPPPPPPP ",
      " PPPYYYPPP ",
      "  PPYYYPP  ",
      " PPPYYYPPP ",
      " PPPPPPPPP ",
      "  PPP PPP  ",
      "     G     ",
      "  GG G     ",
      "   GGG     ",
      "     G     ",
      "     G     ",
    ],
    { P: "lavender", Y: "yellow", G: "forest" },
    "#eee9f2",
  ],
  [
    "cat",
    "Window cat",
    "A very good little listener.",
    "Animals",
    [
      "KK       KK",
      "KOK     KOK",
      "KOOOKKKOOOK",
      "KOOOOOOOOOK",
      "KOOWOOOWOOK",
      "KOOKOOOKOOK",
      "KOOOOPOOOOK",
      " KOOOOOOOK ",
      "  KKKKKKK  ",
    ],
    { K: "brown", O: "peach", W: "white", P: "pink" },
    "#f7e8d9",
  ],
  [
    "rocket",
    "Little rocket",
    "Big dreams. Tiny beads.",
    "Cute",
    [
      "     R     ",
      "    RRR    ",
      "   RRRRR   ",
      "   WWWWW   ",
      "   WBBBW   ",
      "   WBCBW   ",
      "   WBBBW   ",
      "   WWWWW   ",
      "  RWWWWWR  ",
      " RRWWWWWRR ",
      "RRRWWWWWRRR",
      "    OYO    ",
      "    OYO    ",
      "     Y     ",
    ],
    { R: "red", W: "white", B: "blue", C: "cyan", O: "orange", Y: "yellow" },
    "#e5edf4",
  ],
  [
    "cloud",
    "Happy cloud",
    "A little silver lining.",
    "Nature",
    [
      "     WWWW       ",
      "    WWWWWW      ",
      "  WWWWWWWWWWW   ",
      " WWWWWWWWWWWWW  ",
      "WWWWWWWWWWWWWWW ",
      "WWWWKWWWWWKWWWWW",
      "WWWWWWWWWWWWWWWW",
      " WWWWPWWWPWWWWW ",
      "  WWWWWWWWWWWW  ",
    ],
    { W: "white", K: "black", P: "pink" },
    "#e7eff4",
  ],
  [
    "lemon",
    "Lemon squeeze",
    "A fresh little start.",
    "Food",
    [
      "       GG    ",
      "    YYYYGG   ",
      "  YYYYYYYY   ",
      " YYYWYYYYYY  ",
      "YYYYWYYYYYYY ",
      "YYYYYYYYYYYY ",
      " YYYYYYYYYYY ",
      "  YYYYYYYYY  ",
      "    YYYYY    ",
    ],
    { G: "forest", Y: "yellow", W: "lemon" },
    "#f3efd6",
  ],
  [
    "monster",
    "Milo the monster",
    "A friendly original misfit.",
    "Original Characters",
    [
      " P       P ",
      " PP     PP ",
      " PPPPPPPPP ",
      "PPWWPPPWWPP",
      "PPWKPPPKWPP",
      "PPPPPPPPPPP",
      "PPPWWWWWPPP",
      "PPPPPPPPPPP",
      " PPPPPPPPP ",
      "  PP   PP  ",
    ],
    { P: "purple", W: "white", K: "black" },
    "#ece6f1",
  ],
];
export const PRESETS: Preset[] = specs.map(
  ([id, name, description, category, rows, map, background]) => ({
    id,
    name,
    description,
    category,
    size: 29,
    cells: bitmap(
      id === "frog"
        ? Array.from({ length: 23 }, (_, y) =>
            Array.from(
              { length: 23 },
              (_, x) =>
                rows[
                  Math.min(rows.length - 1, Math.floor((y * rows.length) / 23))
                ][Math.floor((x * 19) / 23)] || " ",
            ).join(""),
          )
        : rows,
      map,
    ),
    difficulty: id === "frog" ? "Medium" : "Easy",
    background,
  }),
);
export function createProject(
  size = 29,
  preset?: Preset,
  game = false,
): BeadProject {
  const now = new Date().toISOString();
  return {
    version: 1,
    id: newId(),
    name: preset?.name || "Untitled creation",
    width: preset?.size || size,
    height: preset?.size || size,
    cells:
      preset && !game
        ? [...preset.cells]
        : Array((preset?.size || size) ** 2).fill(null),
    createdAt: now,
    updatedAt: now,
    ...(preset ? { presetId: preset.id } : {}),
    ...(game && preset ? { guide: [...preset.cells] } : {}),
  };
}
export function initialProject(): BeadProject {
  return { ...createProject(29, PRESETS[0]), id: "pocket-frog-demo" };
}
