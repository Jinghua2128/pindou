import { randomBytes } from "node:crypto";
import {
  applyOperation,
  spillToys,
  toyPosition,
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
  version: number;
  lastSpill: number;
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
    version: 0,
    lastSpill: 0,
    peers: new Map(),
  });
  return id;
}
function checkBump(
  room: Room,
  current: Presence,
  previous: Presence,
  now: number,
) {
  const point = current.position,
    from = previous.position;
  if (!point || !from || now - room.lastSpill < 12000) return;
  const { width, height } = room.project;
  for (const { presence: other, seen } of room.peers.values()) {
    const near = other.position;
    if (other.id === current.id || !near || now - seen > 1800) continue;
    if (!current.holding && !current.tray && !other.holding && !other.tray)
      continue;
    // Only crossing into contact counts. Resting side by side cannot retrigger it.
    if (
      Math.hypot(point.x - near.x, point.z - near.z) > 1.65 ||
      Math.hypot(from.x - near.x, from.z - near.z) <= 1.65
    )
      continue;
    let closest: Toy | undefined;
    let radius = Math.max(2.6, width * 0.115);
    for (const t of room.toys) {
      if (t.kind !== "tray") continue;
      if (
        !current.holding &&
        !other.holding &&
        current.tray !== t.id &&
        other.tray !== t.id
      )
        continue;
      const at = toyPosition(t, width, height);
      const distance = Math.hypot(point.x - at.x, point.z - at.z);
      if (distance < radius) {
        closest = t;
        radius = distance;
      }
    }
    if (!closest) continue;
    const spilled = spillToys(room.toys, closest.id);
    if (spilled !== room.toys) {
      room.toys = spilled;
      room.version++;
      room.lastSpill = now;
    }
    return;
  }
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
      if (
        op.toys.some(
          (change) => !change.before && change.after?.kind === "bead",
        )
      )
        room.lastSpill = Date.now();
      room.project = result.project;
      room.toys = result.toys;
      room.version++;
    } else peer.rejected.push(op.seq);
    peer.seq = op.seq;
  }
  peer.rejected = peer.rejected.slice(-64);
  const now = Date.now();
  if (now - peer.seen <= 1800) checkBump(room, presence, peer.presence, now);
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
    version: room.version,
    project: room.project,
    toys: room.toys,
    peers: [...room.peers.values()]
      .filter((p) => Date.now() - p.seen < 7000)
      .map((p) => p.presence),
    rejected: peer.rejected,
  };
}

export function roomInfo(id: string) {
  prune();
  const room = rooms.get(id);
  return room
    ? {
        name: room.project.name,
        players: [...room.peers.values()].filter(
          (p) => Date.now() - p.seen < 7000,
        ).length,
      }
    : null;
}
