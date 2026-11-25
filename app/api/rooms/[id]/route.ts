import { syncSchema } from "@/lib/co-op";
import { syncRoom, roomInfo } from "@/lib/room-server";
import { roomBody } from "@/lib/room-request";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!/^[a-f0-9]{48}$/.test(id))
      return Response.json({ error: "Room not found" }, { status: 404 });
    const { peer, operations, since } = syncSchema.parse(
      await roomBody(request),
    );
    const snapshot = syncRoom(id, peer, operations);
    if (!snapshot)
      return Response.json(
        {
          error:
            "This room has closed. Rooms close when the server restarts or after 12 hours without activity.",
        },
        { status: 410 },
      );
    return Response.json(
      since === snapshot.version && !operations.length
        ? {
            version: snapshot.version,
            peers: snapshot.peers,
            rejected: snapshot.rejected,
            unchanged: true,
          }
        : snapshot,
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    return Response.json(
      { error: "Could not sync this room. Export a copy before leaving." },
      { status: 400 },
    );
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const info = roomInfo(id);
  return info
    ? Response.json(info, { headers: { "Cache-Control": "no-store" } })
    : Response.json(
        {
          error: "This room has closed. Ask your friend for a new invitation.",
        },
        { status: 410 },
      );
}
