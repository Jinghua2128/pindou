import { syncSchema } from "@/lib/co-op";
import { syncRoom } from "@/lib/room-server";
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
    const { peer, operations } = syncSchema.parse(await roomBody(request));
    const snapshot = syncRoom(id, peer, operations);
    if (!snapshot)
      return Response.json(
        {
          error:
            "This room has closed. Rooms close when the server restarts or after 12 hours without activity.",
        },
        { status: 410 },
      );
    return Response.json(snapshot, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { error: "Could not sync this room. Export a copy before leaving." },
      { status: 400 },
    );
  }
}
