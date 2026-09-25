export type BeadColor = {
  id: string;
  name: string;
  hex: string;
  sku: string;
  available: boolean;
  inventoryEnabled: boolean;
};
const entries = [
  ["white", "Porcelain", "#f7f4eb", "W01"],
  ["yellow", "Sunshine", "#f6c842", "Y01"],
  ["orange", "Tangerine", "#f78735", "O01"],
  ["red", "Cherry red", "#ea464b", "R01"],
  ["pink", "Bubblegum", "#f47caa", "P01"],
  ["hotpink", "Raspberry", "#d63085", "P02"],
  ["lavender", "Lilac", "#b69bd8", "V01"],
  ["purple", "Grape", "#775091", "V02"],
  ["cyan", "Pool blue", "#63c7e5", "C01"],
  ["blue", "Cornflower", "#4079db", "B01"],
  ["navy", "Midnight", "#254c79", "B02"],
  ["mint", "Sea glass", "#83cdb0", "G01"],
  ["forest", "Forest", "#28613f", "G02"],
  ["green", "Leaf green", "#48952f", "G03"],
  ["lime", "Lime green", "#b9d967", "G04"],
  ["cream", "Vanilla", "#e9d3a4", "Y02"],
  ["brown", "Cocoa", "#81573e", "N01"],
  ["black", "Licorice", "#303732", "K01"],
  ["grey", "Pebble", "#b9bec0", "N02"],
  ["slate", "Storm", "#7a8588", "N03"],
  ["ochre", "Honey", "#c89b32", "Y03"],
  ["peach", "Apricot", "#f4b387", "O02"],
  ["blush", "Rosewater", "#edb6bd", "P03"],
  ["ivory", "Oat milk", "#ece9dc", "W02"],
  ["coral", "Coral", "#ee7968", "R02"],
  ["wine", "Mulberry", "#a3435d", "R03"],
  ["aqua", "Lagoon", "#43aaad", "C02"],
  ["teal", "Deep teal", "#367c76", "C03"],
  ["sage", "Sage", "#a0b99b", "G05"],
  ["olive", "Olive", "#8e9e50", "G06"],
  ["sky", "Blue sky", "#a2cbe6", "B03"],
  ["periwinkle", "Periwinkle", "#929ad8", "B04"],
  ["lilac", "Orchid", "#c7acd4", "V03"],
  ["sand", "Sand", "#c9ae84", "N04"],
  ["rust", "Terracotta", "#b86e53", "O03"],
  ["lemon", "Lemon drop", "#e9e878", "Y04"],
] as const;
export const COLORS: BeadColor[] = entries.map(([id, name, hex, sku]) => ({
  id,
  name,
  hex,
  sku,
  available: true,
  inventoryEnabled: false,
}));
export const COLOR_MAP = Object.fromEntries(COLORS.map((c) => [c.id, c]));
