import { networkInterfaces } from "node:os";
import { createRoomSchema } from "@/lib/co-op";
import { createRoom } from "@/lib/room-server";
import { roomBody } from "@/lib/room-request";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const { project, toys } = createRoomSchema.parse(await roomBody(request));
    const id = createRoom(project, toys);
    const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;
    const url = new URL(
      configuredUrl && new URL(configuredUrl).protocol === "https:"
        ? configuredUrl
        : request.url,
    );
    // A localhost link cannot open on a friend's device. Offer this host's LAN address.
    if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
      const lan = Object.values(networkInterfaces())
        .flat()
        .find(
          (n) =>
            n &&
            !n.internal &&
            n.family === "IPv4" &&
            /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(n.address),
        );
      if (lan) url.hostname = lan.address;
    }
    url.pathname = `/room/${id}`;
    url.search = "";
    return Response.json(
      { id, invite: url.toString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Could not open a room. Try again or export your project." },
      { status: 400 },
    );
  }
}
