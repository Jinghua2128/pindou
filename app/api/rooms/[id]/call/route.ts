import { z } from "zod";
import { roomInfo } from "@/lib/room-server";
import { roomBody } from "@/lib/room-request";
import {
  account,
  admin,
  configured,
  entitled,
  json,
  replyError,
  requireServices,
  ServiceError,
} from "@/lib/server/services";
import {
  ensureDailyRoom,
  meetingToken,
  type CallSession,
} from "@/lib/server/daily";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
function checkRoom(id: string) {
  if (!roomInfo(id))
    throw new ServiceError(
      "This table has closed. Open a new co-op room first.",
      410,
    );
}
async function activeCall(id: string) {
  const result = await admin()
    .from("call_sessions")
    .select("*")
    .eq("coop_room_id", id)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data as CallSession | null;
}
export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    checkRoom(id);
    if (!configured()) return json({ configured: false, call: null });
    const call = await activeCall(id);
    return json({
      configured: true,
      call: call ? { mode: call.mode, expiresAt: call.expires_at } : null,
    });
  } catch (e) {
    return replyError(e);
  }
}
const input = z.object({
  action: z.enum(["start", "join"]),
  mode: z.enum(["voice", "video"]).default("voice"),
  name: z.string().trim().min(1).max(24),
});
export async function POST(request: Request, context: Context) {
  try {
    const parsed = input.safeParse(await roomBody(request));
    if (!parsed.success)
      throw new ServiceError("Choose a call type and a name.", 400);
    const { id } = await context.params;
    checkRoom(id);
    requireServices();
    const { action, mode, name } = parsed.data;
    let call: CallSession | null;
    if (action === "start") {
      const user = await account(request);
      if (!(await entitled(user.id)))
        throw new ServiceError(
          "PinDou Plus is needed to host. Friends join free.",
          403,
        );
      const db = admin();
      const result = await db.rpc("reserve_call", {
        p_user: user.id,
        p_room: id,
        p_mode: mode,
        p_price: process.env.STRIPE_PLUS_PRICE_ID!,
      });
      if (result.error) {
        const allowed = [
          "An active subscription is required",
          "A friend is already hosting this room",
          "You are already hosting a call",
          "This month’s five call sessions have been used",
        ];
        const message = allowed.find((m) => result.error!.message.includes(m));
        if (message) throw new ServiceError(message, 409);
        throw result.error;
      }
      call = (result.data?.[0] as CallSession | undefined) ?? null;
      if (!call) throw new Error("Missing reservation");
      const room = await ensureDailyRoom(call);
      const saved = await db
        .from("call_sessions")
        .update({
          status: "active",
          provider_room: room.name,
          provider_url: room.url,
        })
        .eq("id", call.id);
      if (saved.error) throw saved.error;
      call = {
        ...call,
        status: "active",
        provider_room: room.name,
        provider_url: room.url,
      };
    } else {
      call = await activeCall(id);
      if (!call)
        throw new ServiceError(
          "There is no active call yet. Ask your host to start one.",
          404,
        );
    }
    if (Date.parse(call.expires_at) <= Date.now())
      throw new ServiceError("This call has ended.", 410);
    if (!(await entitled(call.host_user_id)))
      throw new ServiceError(
        "The host’s subscription is no longer active.",
        403,
      );
    const token = await meetingToken(call, name);
    return json({
      url: call.provider_url,
      token,
      mode: call.mode,
      expiresAt: call.expires_at,
    });
  } catch (e) {
    return replyError(e);
  }
}
