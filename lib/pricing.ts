import type { BeadProject } from "@/types/project";
import { billOfMaterials } from "./grid";
export const DEFAULT_PRICING = {
  currency: "SGD",
  base: 500,
  perBead: 3,
  perExtraColor: 20,
  accessories: { art: 0, keychain: 250, magnet: 200, frame: 1000 },
  packaging: 150,
  handling: 100,
  minimum: 1200,
  shipping: 400,
} as const;
export type ProductType = keyof typeof DEFAULT_PRICING.accessories;
/** All amounts are integer cents. Estimates are not payment authority. */
export function calculatePrice(project: BeadProject, type: ProductType) {
  const bom = billOfMaterials(project.cells),
    beads = bom.reduce((n, c) => n + c.quantity, 0),
    materials = beads * DEFAULT_PRICING.perBead,
    complexity = Math.max(0, bom.length - 6) * DEFAULT_PRICING.perExtraColor,
    accessory = DEFAULT_PRICING.accessories[type],
    subtotal = Math.max(
      DEFAULT_PRICING.minimum,
      DEFAULT_PRICING.base +
        materials +
        complexity +
        accessory +
        DEFAULT_PRICING.packaging +
        DEFAULT_PRICING.handling,
    );
  return {
    beads,
    materials,
    complexity,
    accessory,
    base: DEFAULT_PRICING.base,
    packaging: DEFAULT_PRICING.packaging,
    handling: DEFAULT_PRICING.handling,
    subtotal,
    shipping: DEFAULT_PRICING.shipping,
    total: subtotal + DEFAULT_PRICING.shipping,
    currency: "SGD",
  };
}
export function money(cents: number) {
  return `S$${(cents / 100).toFixed(2)}`;
}
export function orderSnapshot(project: BeadProject, type: ProductType) {
  return structuredClone({
    project,
    productType: type,
    bom: billOfMaterials(project.cells),
    price: calculatePrice(project, type),
    createdAt: new Date().toISOString(),
  });
}
