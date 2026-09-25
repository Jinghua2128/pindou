import { describe, it, expect, beforeEach } from "vitest";
import {
  applyPatches,
  billOfMaterials,
  diff,
  floodIndices,
  lineIndices,
  rectangleIndices,
  structuralCheck,
} from "@/lib/grid";
import { createProject, PRESETS } from "@/lib/presets";
import { useEditor } from "@/stores/editor";
import { calculatePrice, orderSnapshot } from "@/lib/pricing";
import { projectSchema } from "@/types/project";
import { convertPixels } from "@/lib/image-conversion";

describe("logical grid", () => {
  it("draws a continuous line in either direction, including steep slopes", () => {
    expect(lineIndices(0, 12, 5)).toEqual([0, 6, 12]);
    expect(lineIndices(12, 0, 5)).toEqual([12, 6, 0]);
    expect(lineIndices(0, 20, 5)).toEqual([0, 5, 10, 15, 20]);
  });
  it("fills only the connected same-color region and never wraps rows", () => {
    const cells = ["red", null, "red", null, "red", null, "red", null, "red"];
    expect(floodIndices(cells, 0, 3, 3)).toEqual([0]);
    expect(floodIndices(Array(9).fill(null), 0, 3, 3)).toHaveLength(9);
    expect(floodIndices(cells, -1, 3, 3)).toEqual([]);
  });
  it("creates a rectangle perimeter without duplicate corners", () => {
    expect(rectangleIndices(0, 8, 3).sort()).toEqual([0, 1, 2, 3, 5, 6, 7, 8]);
  });
  it("applies compact patches reversibly", () => {
    const before = [null, "red", null],
      after = ["green", null, "blue"],
      patch = diff(before, after);
    expect(applyPatches(before, patch, "after")).toEqual(after);
    expect(applyPatches(after, patch, "before")).toEqual(before);
  });
  it("counts exact material quantities and omits empty cells", () => {
    const bom = billOfMaterials(["red", null, "green", "red"]);
    expect(bom.map(({ colorId, quantity }) => ({ colorId, quantity }))).toEqual(
      [
        { colorId: "red", quantity: 2 },
        { colorId: "green", quantity: 1 },
      ],
    );
    expect(bom[0].percentage).toBeCloseTo(200 / 3);
    expect(bom[1].percentage).toBeCloseTo(100 / 3);
  });
  it("finds disconnected islands without diagonal or row-wrap connections", () => {
    expect(
      structuralCheck(
        ["red", null, null, null, "red", null, null, null, "red"],
        3,
        3,
      ).groups,
    ).toHaveLength(3);
    expect(
      structuralCheck(
        ["red", "red", null, null, "red", null, null, null, null],
        3,
        3,
      ).groups,
    ).toHaveLength(1);
    expect(structuralCheck(Array(9).fill(null), 3, 3).groups).toEqual([]);
  });
});
describe("editing history", () => {
  beforeEach(() => {
    useEditor.getState().load(createProject(16));
    useEditor.setState({
      tool: "pencil",
      color: "red",
      mirror: false,
      fused: false,
    });
  });
  it("cancels an unfinished touch stroke without changing history", () => {
    const s = useEditor.getState();
    s.begin(0);
    s.draw(8);
    s.cancelStroke();
    expect(useEditor.getState().project.cells.filter(Boolean)).toHaveLength(0);
    expect(useEditor.getState().past).toHaveLength(0);
    expect(useEditor.getState().strokeBefore).toBeNull();
  });
  it("groups an entire drag into one undo and redo", () => {
    const s = useEditor.getState();
    s.begin(0);
    s.draw(5);
    s.draw(10);
    s.end();
    expect(useEditor.getState().past).toHaveLength(1);
    expect(useEditor.getState().project.cells.filter(Boolean)).toHaveLength(11);
    s.undo();
    expect(useEditor.getState().project.cells.filter(Boolean)).toHaveLength(0);
    s.redo();
    expect(useEditor.getState().project.cells.filter(Boolean)).toHaveLength(11);
  });
  it("drops the redo branch after a new edit", () => {
    const s = useEditor.getState();
    s.begin(0);
    s.end();
    s.undo();
    s.begin(1);
    s.end();
    expect(useEditor.getState().future).toHaveLength(0);
  });
  it("mirrors a stroke and restores both halves on undo", () => {
    useEditor.setState({ mirror: true });
    const s = useEditor.getState();
    s.begin(1);
    s.end();
    expect(useEditor.getState().project.cells[14]).toBe("red");
    s.undo();
    expect(useEditor.getState().project.cells.filter(Boolean)).toHaveLength(0);
  });
  it("replaces every occurrence of one color as one action", () => {
    const s = useEditor.getState();
    s.begin(1);
    s.draw(3);
    s.end();
    s.replaceColor("red", "blue");
    expect(useEditor.getState().project.cells.slice(1, 4)).toEqual([
      "blue",
      "blue",
      "blue",
    ]);
    s.undo();
    expect(useEditor.getState().project.cells.slice(1, 4)).toEqual([
      "red",
      "red",
      "red",
    ]);
  });
  it("does not add no-op erasure to history", () => {
    const s = useEditor.getState();
    s.begin(0, true);
    s.end();
    expect(useEditor.getState().past).toHaveLength(0);
  });
  it("restores erased cells through undo", () => {
    const s = useEditor.getState();
    s.begin(0);
    s.end();
    s.begin(0, true);
    s.end();
    expect(useEditor.getState().project.cells[0]).toBeNull();
    s.undo();
    expect(useEditor.getState().project.cells[0]).toBe("red");
  });
  it("moves a selection safely and refuses out-of-board movement", () => {
    const s = useEditor.getState();
    s.begin(0);
    s.end();
    useEditor.setState({ selection: { x1: 0, y1: 0, x2: 0, y2: 0 } });
    s.moveSelection(-1, 0);
    expect(useEditor.getState().project.cells[0]).toBe("red");
    s.moveSelection(1, 0);
    expect(useEditor.getState().project.cells[0]).toBeNull();
    expect(useEditor.getState().project.cells[1]).toBe("red");
    s.undo();
    expect(useEditor.getState().project.cells[0]).toBe("red");
  });
  it("supports a full 48 × 48 fill and one-step undo", () => {
    useEditor.getState().load(createProject(48));
    useEditor.setState({ tool: "fill" });
    const s = useEditor.getState();
    s.begin(0);
    s.end();
    expect(useEditor.getState().project.cells.filter(Boolean)).toHaveLength(
      2304,
    );
    s.undo();
    expect(useEditor.getState().project.cells.filter(Boolean)).toHaveLength(0);
  });
});
describe("project integrity and pricing", () => {
  it("has twelve original valid templates with accurate dimensions", () => {
    expect(PRESETS).toHaveLength(12);
    for (const preset of PRESETS)
      expect(projectSchema.safeParse(createProject(29, preset)).success).toBe(
        true,
      );
  });
  it("rejects bad dimensions, unknown colors and truncated grids", () => {
    const p = createProject();
    expect(projectSchema.safeParse({ ...p, cells: [] }).success).toBe(false);
    expect(
      projectSchema.safeParse({ ...p, cells: p.cells.map(() => "<script>") })
        .success,
    ).toBe(false);
    expect(projectSchema.safeParse({ ...p, width: 999 }).success).toBe(false);
    expect(
      projectSchema.safeParse({ ...p, guide: p.cells.map(() => "unknown") })
        .success,
    ).toBe(false);
    expect(
      projectSchema.safeParse({ ...p, createdAt: "yesterday" }).success,
    ).toBe(false);
  });
  it("uses integer-cent pricing, accessory increments, and minimum order", () => {
    const p = createProject();
    expect(calculatePrice(p, "art").total).toBe(1600);
    const frog = createProject(29, PRESETS[0]);
    expect(
      calculatePrice(frog, "keychain").total -
        calculatePrice(frog, "art").total,
    ).toBe(250);
    expect(Number.isInteger(calculatePrice(frog, "frame").total)).toBe(true);
  });
  it("freezes order data independently of later project edits", () => {
    const p = createProject(29, PRESETS[0]),
      snapshot = orderSnapshot(p, "keychain");
    p.cells.fill(null);
    p.name = "Changed";
    expect(snapshot.project.cells.filter(Boolean).length).toBeGreaterThan(0);
    expect(snapshot.project.name).toBe("Pocket frog");
    expect(snapshot.bom.reduce((n, c) => n + c.quantity, 0)).toBe(
      snapshot.price.beads,
    );
  });
  it("creates template games with a separate guide", () => {
    const p = createProject(29, PRESETS[0], true);
    expect(p.cells.every((c) => c === null)).toBe(true);
    expect(p.guide).toEqual(PRESETS[0].cells);
    p.guide![0] = "red";
    expect(PRESETS[0].cells[0]).toBeNull();
  });
  it("handles transparent and white image backgrounds", () => {
    expect(
      convertPixels(
        new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 0]),
        12,
        true,
        1,
      ),
    ).toEqual([null, null]);
    const cells = convertPixels(
      new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 255]),
      1,
      false,
      1,
    );
    expect(new Set(cells).size).toBe(1);
  });
});
