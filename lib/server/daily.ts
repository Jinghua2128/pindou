import { CALL_POLICY, callPermissions } from "@/lib/call-policy";
import { ServiceError } from "./services";
export type CallSession = {
  id: string;
  host_user_id: string;
  mode: "voice" | "video";
  expires_at: string;
  provider_room: string | null;
  provider_url: string | null;
  status: string;
};
async function daily(path: string, body?: unknown) {
  return fetch(`https://api.daily.co/v1/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
}
export async function ensureDailyRoom(call: CallSession) {
  const name = `pindou-${call.id.replaceAll("-", "")}`;
  // A stable name makes a retry safe even when the creation response was lost.
  let response = await daily(`rooms/${name}`);
  if (response.status === 404) {
    response = await daily("rooms", {
      name,
      privacy: "private",
      properties: {
        exp: Math.floor(Date.parse(call.expires_at) / 1000),
        eject_at_room_exp: true,
        max_participants: CALL_POLICY.maxParticipants,
        enable_prejoin_ui: true,
        enable_screenshare: false,
        enable_chat: false,
        start_video_off: true,
        start_audio_off: true,
        permissions: callPermissions(call.mode),
      },
    });
    if (!response.ok) response = await daily(`rooms/${name}`);
  }
  if (!response.ok)
    throw new ServiceError(
      "The call provider is unavailable. Retry to use the same reserved session.",
      503,
    );
  const room = await response.json();
  if (
    room.name !== name ||
    room.privacy !== "private" ||
    typeof room.url !== "string"
  )
    throw new ServiceError("The call room could not be verified.", 503);
  return { name, url: room.url as string };
}
export async function meetingToken(call: CallSession, name: string) {
  if (!call.provider_room)
    throw new ServiceError(
      "Your host is still opening the call. Try again shortly.",
      409,
    );
  const response = await daily("meeting-tokens", {
    properties: {
      room_name: call.provider_room,
      exp: Math.floor(Date.parse(call.expires_at) / 1000),
      eject_at_token_exp: true,
      user_name: name,
      is_owner: false,
      permissions: callPermissions(call.mode),
    },
  });
  if (!response.ok)
    throw new ServiceError("Could not join the call. Please try again.", 503);
  const result = await response.json();
  if (typeof result.token !== "string")
    throw new ServiceError("Could not verify the call invitation.", 503);
  return result.token as string;
}
