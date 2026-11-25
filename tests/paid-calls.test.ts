import { describe, it, expect, vi, afterEach } from "vitest";
import { hasPaidAccess, callPermissions } from "@/lib/call-policy";
import { invitationPath } from "@/lib/invitations";
import {
  ensureDailyRoom,
  meetingToken,
  type CallSession,
} from "@/lib/server/daily";
import { GET as billingStatus } from "@/app/api/billing/status/route";
import { POST as checkout } from "@/app/api/billing/checkout/route";
import { POST as webhook } from "@/app/api/billing/webhook/route";
import { GET as roomGet, POST as roomSync } from "@/app/api/rooms/[id]/route";
import { POST as callPost } from "@/app/api/rooms/[id]/call/route";
import { createRoom } from "@/lib/room-server";
import { createProject } from "@/lib/presets";
const request = (url: string, body: unknown) =>
  new Request(`http://localhost:3000${url}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("paid call boundaries", () => {
  it("requires a subscriber to start, lets a guest join free, and blocks new joins after revocation", async () => {
    const host = crypto.randomUUID(),
      id = createRoom(createProject(), []);
    for (const [key, value] of Object.entries({
      NEXT_PUBLIC_SUPABASE_URL: "https://database.invalid",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test",
      SUPABASE_SERVICE_ROLE_KEY: "test",
      STRIPE_SECRET_KEY: "test",
      STRIPE_WEBHOOK_SECRET: "test",
      STRIPE_PLUS_PRICE_ID: "plus",
      DAILY_API_KEY: "test",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    }))
      vi.stubEnv(key, value);
    const transport = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", transport);
    function replies(...values: unknown[]) {
      for (const value of values)
        transport.mockResolvedValueOnce(Response.json(value));
    }
    const submit = (action: "start" | "join", signedIn = false) => {
      const req = request(`/api/rooms/${id}/call`, {
        action,
        name: signedIn ? "Host" : "Friend",
        mode: "voice",
      });
      if (signedIn) req.headers.set("authorization", "Bearer host-test-token");
      return callPost(req, { params: Promise.resolve({ id }) });
    };
    expect((await submit("start")).status).toBe(401);
    expect(transport).not.toHaveBeenCalled();
    replies({ id: host }, []);
    expect((await submit("start", true)).status).toBe(403);
    const expires = new Date(Date.now() + 30 * 60000).toISOString();
    const subscription = [
      { status: "active", price_id: "plus", current_period_end: expires },
    ];
    const session = {
      id: crypto.randomUUID(),
      host_user_id: host,
      expires_at: expires,
      mode: "voice",
      status: "pending",
    };
    const name = `pindou-${session.id.replaceAll("-", "")}`,
      url = `https://example.daily.co/${name}`;
    replies(
      { id: host },
      subscription,
      [session],
      { name, url, privacy: "private" },
      null,
      subscription,
      { token: "host-ticket" },
    );
    const started = await submit("start", true);
    expect(started.status).toBe(200);
    expect(await started.json()).toMatchObject({
      url,
      token: "host-ticket",
      mode: "voice",
    });
    transport.mockClear();
    const active = [
      { ...session, status: "active", provider_room: name, provider_url: url },
    ];
    replies(active, subscription, { token: "guest-ticket" });
    const joined = await submit("join");
    expect(joined.status).toBe(200);
    expect(await joined.json()).toMatchObject({ url, token: "guest-ticket" });
    const urls = transport.mock.calls.map(([input]) => new URL(String(input)));
    expect(urls.map((u) => u.pathname)).toEqual([
      "/rest/v1/call_sessions",
      "/rest/v1/subscriptions",
      "/v1/meeting-tokens",
    ]);
    expect(urls[0].searchParams.get("coop_room_id")).toBe(`eq.${id}`);
    expect(urls[1].searchParams.get("user_id")).toBe(`eq.${host}`);
    transport.mockClear();
    replies(active, []);
    expect((await submit("join")).status).toBe(403);
    expect(transport).toHaveBeenCalledTimes(2); // No new meeting token.
  });
  it("requires an active matching unexpired subscription", () => {
    const now = Date.parse("2026-09-29T00:00:00Z");
    const sub = {
      status: "active",
      price_id: "price_plus",
      current_period_end: "2026-10-01T00:00:00Z",
    };
    expect(hasPaidAccess(sub, "price_plus", now)).toBe(true);
    for (const status of [
      "trialing",
      "past_due",
      "incomplete",
      "canceled",
      "unpaid",
    ])
      expect(hasPaidAccess({ ...sub, status }, "price_plus", now)).toBe(false);
    expect(hasPaidAccess(sub, "price_other", now)).toBe(false);
    expect(
      hasPaidAccess(
        { ...sub, current_period_end: "2026-09-01" },
        "price_plus",
        now,
      ),
    ).toBe(false);
    expect(hasPaidAccess(null, "price_plus", now)).toBe(false);
  });
  it("never gives voice guests video, screen-share or admin permissions", () => {
    expect(callPermissions("voice")).toEqual({
      canSend: ["audio"],
      canAdmin: false,
    });
    expect(callPermissions("video")).toEqual({
      canSend: ["audio", "video"],
      canAdmin: false,
    });
  });
  it("keeps billing disabled without credentials and rejects anonymous checkout", async () => {
    vi.stubEnv("DAILY_API_KEY", "");
    expect(
      await (
        await billingStatus(
          new Request("http://localhost:3000/api/billing/status"),
        )
      ).json(),
    ).toMatchObject({ configured: false, active: false });
    expect((await checkout(request("/api/billing/checkout", {}))).status).toBe(
      401,
    );
    expect(
      (
        await webhook(
          request("/api/billing/webhook", {
            type: "customer.subscription.updated",
          }),
        )
      ).status,
    ).toBe(400);
  });
  it("will not start a provider call when the studio is unconfigured", async () => {
    vi.stubEnv("DAILY_API_KEY", "");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const id = createRoom(createProject(), []);
    const response = await callPost(
      request(`/api/rooms/${id}/call`, {
        action: "start",
        mode: "voice",
        name: "Maker",
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(response.status).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("binds private calls and guest tokens to the reserved room and expiration", async () => {
    vi.stubEnv("DAILY_API_KEY", "test-key");
    const call: CallSession = {
      id: "715f834d-7c31-4f98-9e00-fdf2b12a3f84",
      mode: "voice",
      host_user_id: "host",
      expires_at: "2026-09-29T12:30:00Z",
      provider_room: null,
      provider_url: null,
      status: "pending",
    };
    const name = "pindou-715f834d7c314f989e00fdf2b12a3f84";
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 404 }))
      .mockResolvedValueOnce(
        Response.json({
          name,
          privacy: "private",
          url: `https://example.daily.co/${name}`,
        }),
      )
      .mockResolvedValueOnce(Response.json({ token: "test-token" }));
    vi.stubGlobal("fetch", fetcher);
    const room = await ensureDailyRoom(call);
    const body = JSON.parse(fetcher.mock.calls[1][1].body);
    expect(body).toMatchObject({
      name,
      privacy: "private",
      properties: {
        max_participants: 4,
        eject_at_room_exp: true,
        start_audio_off: true,
        start_video_off: true,
        enable_screenshare: false,
        permissions: { canSend: ["audio"], canAdmin: false },
      },
    });
    expect(body.properties.exp).toBe(Date.parse(call.expires_at) / 1000);
    expect(
      await meetingToken({ ...call, provider_room: room.name }, "Friend"),
    ).toBe("test-token");
    expect(JSON.parse(fetcher.mock.calls[2][1].body).properties).toMatchObject({
      room_name: name,
      exp: body.properties.exp,
      eject_at_token_exp: true,
      is_owner: false,
      user_name: "Friend",
    });
  });
});
describe("invitation and lightweight sync", () => {
  it("accepts invitation paths and strips unrelated URL parts without external navigation", () => {
    const path = `/room/${"a".repeat(48)}`;
    expect(invitationPath(`https://example.com${path}?tracking=1#x`)).toBe(
      path,
    );
    expect(invitationPath(path)).toBe(path);
    for (const value of [
      "javascript:alert(1)",
      "/account/plus",
      "hello",
      "https://example.com/room/short",
    ])
      expect(invitationPath(value)).toBeNull();
  });
  it("lets guests preview the table and avoids repeating unchanged artwork", async () => {
    const id = createRoom(createProject(), []),
      context = { params: Promise.resolve({ id }) };
    expect(
      (
        await roomGet(
          new Request(`http://localhost:3000/api/rooms/${id}`),
          context,
        )
      ).status,
    ).toBe(200);
    const peer = {
      id: crypto.randomUUID(),
      name: "Maker",
      cell: null,
      holding: null,
    };
    const initial = await (
      await roomSync(
        request(`/api/rooms/${id}`, { peer, operations: [] }),
        context,
      )
    ).json();
    const same = await (
      await roomSync(
        request(`/api/rooms/${id}`, {
          peer,
          operations: [],
          since: initial.version,
        }),
        context,
      )
    ).json();
    expect(same.unchanged).toBe(true);
    expect(same.project).toBeUndefined();
    expect(same.peers).toHaveLength(1);
    const changed = await (
      await roomSync(
        request(`/api/rooms/${id}`, {
          peer,
          since: initial.version,
          operations: [
            {
              seq: 1,
              cells: [{ index: 0, before: null, after: "pink" }],
              toys: [],
            },
          ],
        }),
        context,
      )
    ).json();
    expect(changed.version).toBeGreaterThan(initial.version);
    expect(changed.project.cells[0]).toBe("pink");
  });
});
