import { randomBytes } from "node:crypto";
import {
  applyOperation,
  type Presence,
  type RoomSnapshot,
  type Toy,
  type Operation,
} from "@/lib/co-op";
import type { BeadProject } from "@/types/project";

type Room = {
  project: BeadProject;
  toys: Toy[];
  touched: number;
  peers: Map<
    string,
    { presence: Presence; seen: number; seq: number; rejected: number[] }
  >;
};
// A single Node process owns the rooms. Keep this registry across development hot reloads.
const scope = globalThis as typeof globalThis & {
  pindouRooms?: Map<string, Room>;
};
const rooms = (scope.pindouRooms ??= new Map<string, Room>());
const TTL = 12 * 60 * 60 * 1000;
function prune() {
  for (const [id, room] of rooms)
    if (Date.now() - room.touched > TTL) rooms.delete(id);
}
export function createRoom(project: BeadProject, toys: Toy[]) {
  prune();
  if (rooms.size >= 100)
    throw new Error("The table is full. Please try again later.");
  const id = randomBytes(24).toString("hex");
  rooms.set(id, {
    project: { ...project, id: `coop-${id}` },
    toys,
    touched: Date.now(),
    peers: new Map(),
  });
  return id;
}
export function syncRoom(
  id: string,
  presence: Presence,
  operations: Operation[],
): RoomSnapshot | null {
  prune();
  const room = rooms.get(id);
  if (!room) return null;
  // Retain sequence receipts for the room's lifetime so reconnect retries are idempotent.
  if (!room.peers.has(presence.id) && room.peers.size >= 64)
    throw new Error("This room is full.");
  const peer = room.peers.get(presence.id) ?? {
    presence,
    seen: Date.now(),
    seq: 0,
    rejected: [],
  };
  for (const op of operations) {
    if (op.seq <= peer.seq) continue;
    const result = applyOperation(room.project, room.toys, op);
    if (result) {
      room.project = result.project;
      room.toys = result.toys;
    } else peer.rejected.push(op.seq);
    peer.seq = op.seq;
  }
  peer.rejected = peer.rejected.slice(-64);
  peer.presence = {
    ...presence,
    cell:
      presence.cell !== null && presence.cell < room.project.cells.length
        ? presence.cell
        : null,
  };
  peer.seen = room.touched = Date.now();
  room.peers.set(presence.id, peer);
  return {
    project: room.project,
    toys: room.toys,
    peers: [...room.peers.values()]
      .filter((p) => Date.now() - p.seen < 7000)
      .map((p) => p.presence),
    rejected: peer.rejected,
  };
}
