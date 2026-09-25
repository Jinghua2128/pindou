import { describe, it, expect } from "vitest";
import {
  applyOperation,
  initialToys,
  syncSchema,
  type Operation,
} from "@/lib/co-op";
import { createRoom, syncRoom } from "@/lib/room-server";
import { createProject } from "@/lib/presets";
import { useEditor } from "@/stores/editor";
import { usePlay } from "@/stores/play";
import { newId } from "@/lib/id";
import { z } from "zod";

const peer = () => ({
  id: crypto.randomUUID(),
  name: "Maker",
  cell: null,
  holding: null,
});
const op = (
  seq: number,
  index: number,
  before: string | null,
  after: string | null,
): Operation => ({ seq, cells: [{ index, before, after }], toys: [] });
describe("shared table", () => {
  it("generates valid unique UUIDs using the LAN-compatible random API", () => {
    const ids = Array.from({ length: 100 }, newId);
    expect(ids.every((id) => z.uuid().safeParse(id).success)).toBe(true);
    expect(new Set(ids).size).toBe(100);
  });
  it("merges two makers' independent cells and retries an operation exactly once", () => {
    const id = createRoom(createProject(), initialToys()),
      a = peer(),
      b = peer();
    syncRoom(id, a, [op(1, 0, null, "pink")]);
    syncRoom(id, b, [op(1, 1, null, "green")]);
    const result = syncRoom(id, a, [op(1, 0, null, "pink")])!;
    expect(result.project.cells.slice(0, 2)).toEqual(["pink", "green"]);
    expect(result.rejected).toEqual([]);
    expect(result.peers).toHaveLength(2);
  });
  it("rejects stale moves atomically, including consumption of a loose bead", () => {
    const project = createProject();
    project.cells[1] = "green";
    const toy = { ...initialToys()[0], id: "loose", kind: "bead" as const };
    const result = applyOperation(project, [toy], {
      seq: 1,
      cells: [{ index: 1, before: null, after: "pink" }],
      toys: [{ id: toy.id, before: toy, after: null }],
    });
    expect(result).toBeNull();
    expect(project.cells[1]).toBe("green");
  });
  it("retains rejected receipts when a response is lost", () => {
    const id = createRoom(createProject(), []),
      a = peer(),
      b = peer();
    syncRoom(id, a, [op(1, 2, null, "pink")]);
    syncRoom(id, b, [op(1, 2, null, "blue")]);
    expect(syncRoom(id, b, [op(1, 2, null, "blue")])!.rejected).toEqual([1]);
  });
  it("syncs boxes without touching the artwork", () => {
    const project = createProject(),
      toys = initialToys();
    const moved = { ...toys[0], x: 70, angle: 22 };
    const result = applyOperation(project, toys, {
      seq: 1,
      cells: [],
      toys: [{ id: moved.id, before: toys[0], after: moved }],
    })!;
    expect(result.toys.find((t) => t.id === moved.id)).toEqual(moved);
    expect(result.project.cells).toEqual(project.cells);
  });
  it("rejects invalid colors, out of bounds cells, and duplicate patch indices", () => {
    expect(
      syncSchema.safeParse({
        peer: peer(),
        operations: [op(1, 0, null, "unknown")],
      }).success,
    ).toBe(false);
    const project = createProject();
    expect(applyOperation(project, [], op(1, 4095, null, "green"))).toBeNull();
    expect(
      applyOperation(project, [], {
        seq: 1,
        cells: [
          ...op(1, 0, null, "pink").cells,
          ...op(1, 0, null, "green").cells,
        ],
        toys: [],
      }),
    ).toBeNull();
  });
  it("returns no snapshot for a room that does not exist", () => {
    expect(syncRoom("missing", peer(), [])).toBeNull();
  });
  it("undo preserves a friend's replacement and redo never restores skipped cells", () => {
    useEditor.getState().load(createProject());
    useEditor.getState().putBead(1, "pink");
    const cells = [...useEditor.getState().project.cells];
    cells[1] = "green";
    useEditor.setState((s) => ({ project: { ...s.project, cells } }));
    useEditor.getState().undo();
    expect(useEditor.getState().project.cells[1]).toBe("green");
    useEditor.getState().redo();
    expect(useEditor.getState().project.cells[1]).toBe("green");
  });
  it("grabbing swaps occupied pegs and cancellation leaves the original in place", () => {
    useEditor.getState().load(createProject());
    useEditor.getState().putBead(0, "pink");
    useEditor.getState().putBead(1, "green");
    usePlay.getState().pick({ color: "pink", source: 0 });
    expect(useEditor.getState().project.cells[0]).toBe("pink");
    usePlay.setState({ held: null });
    expect(useEditor.getState().project.cells[0]).toBe("pink");
    usePlay.getState().pick({ color: "pink", source: 0 });
    usePlay.getState().place(1);
    expect(useEditor.getState().project.cells.slice(0, 2)).toEqual([
      "green",
      "pink",
    ]);
    useEditor.getState().undo();
    expect(useEditor.getState().project.cells.slice(0, 2)).toEqual([
      "pink",
      "green",
    ]);
  });
  it("never partially undoes a swap when a friend changed its destination", () => {
    useEditor.getState().load(createProject());
    useEditor.getState().putBead(0, "pink");
    useEditor.getState().putBead(1, "green");
    useEditor.getState().putBead(1, "pink", 0);
    const cells = [...useEditor.getState().project.cells];
    cells[1] = "yellow";
    useEditor.setState((s) => ({ project: { ...s.project, cells } }));
    useEditor.getState().undo();
    expect(useEditor.getState().project.cells.slice(0, 2)).toEqual([
      "green",
      "yellow",
    ]);
  });
});
