import { describe, it, expect, vi } from "vitest";
import {
  applyOperation,
  initialToys,
  toyPosition,
  syncSchema,
  toyDiff,
  swingDirection,
  spillToys,
  type TraySample,
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
    const moved = { ...toys[0], x: 70, y: 75, angle: 22 };
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

describe("physical placement and shared bumps", () => {
  it("keeps gestures, history and project identity when switching placement", () => {
    const editor = useEditor.getState(),
      project = createProject();
    editor.load(project);
    editor.setPlacement("classic");
    editor.begin(0);
    editor.draw(2);
    editor.setPlacement("interactive");
    const cells = [...useEditor.getState().project.cells];
    expect(cells.slice(0, 3).every(Boolean)).toBe(true);
    editor.setTool("fill");
    editor.begin(4);
    expect(useEditor.getState().project.cells).toEqual(cells);
    usePlay.getState().pick({ color: "pink", trayId: "tray-1" });
    usePlay.getState().place(4);
    usePlay.getState().place(5);
    expect(useEditor.getState().project.cells.slice(4, 6)).toEqual([
      "pink",
      null,
    ]);
    editor.setPlacement("classic");
    expect(useEditor.getState().project.id).toBe(project.id);
    editor.undo();
    expect(useEditor.getState().project.cells).toEqual(cells);
    editor.redo();
    expect(useEditor.getState().project.cells[4]).toBe("pink");
  });
  it("spills once for entering an active tray interaction, never for idle proximity or away from boxes", () => {
    const project = createProject(),
      toys = initialToys(),
      room = createRoom(project, toys);
    const point = toyPosition(toys[1], project.width, project.height);
    const a = { ...peer(), position: point };
    const b = { ...peer(), position: { ...point, x: point.x + 5 } };
    syncRoom(room, a, []);
    syncRoom(room, b, []);
    expect(syncRoom(room, { ...b, position: point }, [])!.toys).toHaveLength(3);
    syncRoom(room, { ...a, holding: "pink" }, []);
    syncRoom(room, b, []);
    const spilled = syncRoom(room, { ...b, position: point }, [])!;
    expect(spilled.toys).toHaveLength(13);
    expect(syncRoom(room, a, [])!.toys).toEqual(spilled.toys);
    syncRoom(room, b, []);
    expect(
      syncRoom(room, { ...b, position: point, holding: "pink" }, [])!.toys,
    ).toHaveLength(13);
    const elsewhere = createRoom(project, toys);
    syncRoom(
      elsewhere,
      { ...a, holding: "pink", position: { x: 0, z: 0 } },
      [],
    );
    syncRoom(elsewhere, { ...b, position: { x: 4, z: 0 } }, []);
    expect(
      syncRoom(elsewhere, { ...b, position: { x: 0, z: 0 } }, [])!.toys,
    ).toHaveLength(3);
  });
  it("requires fresh contact and an actual active box, then rearms only after separation and cooldown", () => {
    vi.useFakeTimers();
    try {
      const project = createProject(),
        toys = initialToys(),
        room = createRoom(project, toys);
      const pos = toyPosition(toys[0], project.width, project.height);
      const a = { ...peer(), position: pos, tray: toys[0].id };
      const b = { ...peer(), position: { ...pos, x: pos.x + 5 } },
        close = { ...b, position: pos };
      syncRoom(room, a, []);
      syncRoom(room, b, []);
      vi.advanceTimersByTime(2000);
      expect(syncRoom(room, close, [])!.toys).toHaveLength(3);
      syncRoom(room, { ...a, tray: "missing" }, []);
      syncRoom(room, b, []);
      expect(syncRoom(room, close, [])!.toys).toHaveLength(3);
      syncRoom(room, a, []);
      syncRoom(room, b, []);
      expect(syncRoom(room, close, [])!.toys).toHaveLength(13);
      vi.advanceTimersByTime(13000);
      syncRoom(room, a, []);
      expect(syncRoom(room, close, [])!.toys).toHaveLength(13);
      syncRoom(room, b, []);
      expect(syncRoom(room, close, [])!.toys).toHaveLength(23);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("box movement", () => {
  it("measures a short fast swing, ignoring slow travel, pauses and jitter", () => {
    const start = { x: 0, z: 0, time: 0 };
    expect(swingDirection([start], { x: 0.055, z: 0, time: 40 })).toEqual({
      x: 1,
      z: 0,
    });
    expect(swingDirection([start], { x: 0, z: 0.06, time: 135 })).toBeNull();
    expect(swingDirection([start], { x: 0.01, z: 0, time: 4 })).toBeNull();
    const samples: TraySample[] = [start];
    expect(swingDirection(samples, { x: 0, z: -0.12, time: 500 })).toBeNull();
    expect(swingDirection(samples, { x: 0, z: -0.2, time: 535 })).toEqual({
      x: 0,
      z: -1,
    });
  });
  it("keeps added colors and box IDs when tidying, with room for six boxes", () => {
    usePlay.setState({ toys: initialToys() });
    const play = usePlay.getState();
    for (const color of ["lavender", "red", "blue"])
      expect(play.addBox(color)).toBe(true);
    expect(play.addBox("black")).toBe(false);
    const extra = usePlay.getState().toys.find((t) => t.color === "lavender")!;
    expect(toyPosition(extra, 29, 29).z).toBeLessThan(-14.5);
    play.spill(extra.id, { x: 0, z: -1 });
    const spilled = usePlay.getState().toys.filter((t) => t.kind === "bead");
    expect(spilled).toHaveLength(5);
    expect(
      spilled.every(
        (t) =>
          t.color === "lavender" &&
          t.side === "back" &&
          t.origin?.x === extra.x,
      ),
    ).toBe(true);
    play.tidy();
    expect(usePlay.getState().toys.map((t) => t.color)).toEqual([
      "green",
      "pink",
      "yellow",
      "lavender",
      "red",
      "blue",
    ]);
    play.putAway(extra.id);
    expect(play.addBox("black")).toBe(true);
    usePlay.setState({ toys: initialToys() });
  });
  it("rejects a concurrent move into another maker’s box", () => {
    const boxes = initialToys(),
      room = createRoom(createProject(), boxes);
    const move = (i: number, x: number): Operation => ({
      seq: 1,
      cells: [],
      toys: [{ id: boxes[i].id, before: boxes[i], after: { ...boxes[i], x } }],
    });
    expect(syncRoom(room, peer(), [move(0, 26)])!.rejected).toEqual([]);
    const snapshot = syncRoom(room, peer(), [move(1, 44)])!;
    expect(snapshot.rejected).toEqual([1]);
    expect(snapshot.toys.find((t) => t.id === boxes[1].id)?.x).toBe(50);
  });
  it("stops against other boxes, and scatters only once when the room retries the same operation", () => {
    const boxes = initialToys();
    usePlay.setState({ toys: boxes });
    usePlay.getState().moveToy("tray-1", 99, 30);
    expect(usePlay.getState().toys[1].x).toBe(56);
    const after = spillToys(boxes, "tray-1", { x: 1, z: 0 });
    const id = createRoom(createProject(), boxes),
      maker = peer();
    const change = { seq: 1, cells: [], toys: toyDiff(boxes, after) };
    syncRoom(id, maker, [change]);
    expect(syncRoom(id, maker, [change])!.toys).toEqual(
      expect.arrayContaining(after),
    );
    expect(syncRoom(id, maker, [])!.toys).toHaveLength(8);
    usePlay.setState({ toys: initialToys() });
  });
});
