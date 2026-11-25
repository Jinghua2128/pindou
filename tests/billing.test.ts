import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as webhook } from "@/app/api/billing/webhook/route";
import { POST as checkout } from "@/app/api/billing/checkout/route";
import { GET as status } from "@/app/api/billing/status/route";

vi.mock("@/lib/server/services", async (original) => ({
  ...(await original<typeof import("@/lib/server/services")>()),
  stripe: () =>
    new Stripe("sk_test_fixture", {
      httpClient: Stripe.createFetchHttpClient(),
    }),
}));

const payments = new Stripe("sk_test_fixture");
const transport = vi.fn<typeof fetch>();
const end = Math.floor(Date.now() / 1000) + 86400;
const price = {
  id: "price_plus",
  active: true,
  type: "recurring",
  currency: "sgd",
  unit_amount: 490,
  livemode: false,
  recurring: { interval: "month", interval_count: 1 },
};
const subscription = {
  id: "sub_plus",
  customer: "cus_host",
  status: "active",
  latest_invoice: { id: "in_paid", status: "paid" },
  items: { data: [{ price, current_period_end: end }] },
};

beforeEach(() => {
  transport.mockReset();
  vi.stubGlobal("fetch", transport);
  for (const [key, value] of Object.entries({
    NEXT_PUBLIC_SUPABASE_URL: "https://database.invalid",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "test",
    SUPABASE_SERVICE_ROLE_KEY: "test",
    STRIPE_SECRET_KEY: "sk_test_fixture",
    STRIPE_WEBHOOK_SECRET: "whsec_fixture",
    STRIPE_PLUS_PRICE_ID: price.id,
    DAILY_API_KEY: "test",
    NEXT_PUBLIC_APP_URL: "https://studio.example",
  }))
    vi.stubEnv(key, value);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
function replies(...values: unknown[]) {
  for (const value of values)
    transport.mockResolvedValueOnce(Response.json(value));
}
function eventRequest(type: string, object: unknown, signature?: string) {
  const payload = JSON.stringify({
    id: "evt_fixture",
    type,
    created: 1790000000,
    data: { object },
  });
  return new Request("https://studio.example/api/billing/webhook", {
    method: "POST",
    body: payload,
    headers: {
      "stripe-signature":
        signature ??
        payments.webhooks.generateTestHeaderString({
          payload,
          secret: "whsec_fixture",
        }),
    },
  });
}
function savedSubscription() {
  const call = transport.mock.calls.find(([input]) =>
    String(input).endsWith("/rpc/apply_subscription"),
  );
  return JSON.parse(String(call?.[1]?.body));
}

describe("Stripe payment lifecycle", () => {
  it.each([
    ["customer.subscription.created", { id: "sub_plus" }],
    ["customer.subscription.updated", { id: "sub_plus" }],
    ["customer.subscription.deleted", { id: "sub_plus" }],
    ["checkout.session.completed", { subscription: "sub_plus" }],
    [
      "checkout.session.async_payment_succeeded",
      { subscription: { id: "sub_plus" } },
    ],
    ["checkout.session.async_payment_failed", { subscription: "sub_plus" }],
    [
      "invoice.paid",
      { parent: { subscription_details: { subscription: "sub_plus" } } },
    ],
    [
      "invoice.payment_failed",
      { parent: { subscription_details: { subscription: "sub_plus" } } },
    ],
    [
      "invoice.payment_action_required",
      { parent: { subscription_details: { subscription: "sub_plus" } } },
    ],
  ])(
    "reconciles %s from Stripe's current subscription",
    async (type, object) => {
      replies(subscription, { user_id: "host" }, null);
      expect((await webhook(eventRequest(type, object))).status).toBe(200);
      expect(String(transport.mock.calls[0][0])).toContain(
        "/v1/subscriptions/sub_plus?expand[0]=latest_invoice",
      );
      expect(savedSubscription()).toMatchObject({
        p_id: "sub_plus",
        p_user: "host",
        p_status: "active",
        p_price: price.id,
        p_end: new Date(end * 1000).toISOString(),
        p_event_created: 1790000000,
      });
    },
  );
  it("does not grant time for an active subscription whose payment is still pending", async () => {
    replies(
      { ...subscription, latest_invoice: { status: "open" } },
      { user_id: "host" },
      null,
    );
    await webhook(
      eventRequest("checkout.session.completed", { subscription: "sub_plus" }),
    );
    expect(savedSubscription().p_end).toBe(new Date(0).toISOString());
  });
  it("revokes access after renewal failure and preserves access for scheduled cancellation", async () => {
    replies(
      {
        ...subscription,
        status: "past_due",
        latest_invoice: { status: "open" },
      },
      { user_id: "host" },
      null,
    );
    await webhook(
      eventRequest("invoice.payment_failed", {
        parent: { subscription_details: { subscription: "sub_plus" } },
      }),
    );
    expect(savedSubscription()).toMatchObject({
      p_status: "past_due",
      p_end: new Date(0).toISOString(),
    });
    transport.mockClear();
    replies(
      { ...subscription, cancel_at_period_end: true },
      { user_id: "host" },
      null,
    );
    await webhook(
      eventRequest("customer.subscription.updated", {
        id: "sub_plus",
        status: "past_due",
      }),
    );
    expect(savedSubscription()).toMatchObject({
      p_status: "active",
      p_end: new Date(end * 1000).toISOString(),
    });
  });
  it("rejects forged events and ignores invoices unrelated to subscriptions", async () => {
    expect(
      (await webhook(eventRequest("invoice.paid", {}, "t=1,v1=forged"))).status,
    ).toBe(400);
    expect(
      (await webhook(eventRequest("invoice.paid", { parent: null }))).status,
    ).toBe(200);
    expect(transport).not.toHaveBeenCalled();
  });
  it("ignores unknown customers and asks Stripe to retry database failures", async () => {
    replies(subscription, null);
    expect(
      (
        await webhook(
          eventRequest("customer.subscription.created", { id: "sub_plus" }),
        )
      ).status,
    ).toBe(200);
    expect(transport).toHaveBeenCalledTimes(2);
    transport.mockClear();
    replies(subscription, { user_id: "host" });
    transport.mockResolvedValueOnce(
      Response.json({ message: "database unavailable" }, { status: 503 }),
    );
    expect(
      (
        await webhook(
          eventRequest("invoice.paid", {
            parent: { subscription_details: { subscription: "sub_plus" } },
          }),
        )
      ).status,
    ).toBe(503);
  });
});

describe("hosted billing", () => {
  function checkoutRequest() {
    return new Request("https://studio.example/api/billing/checkout", {
      method: "POST",
      body: "{}",
      headers: { authorization: "Bearer fixture" },
    });
  }
  function hostReplies(
    subscriptions: unknown[] = [],
    sessions: unknown[] = [],
  ) {
    replies(
      { id: "host" },
      [],
      price,
      { stripe_customer_id: "cus_host" },
      { data: subscriptions },
      { data: sessions },
    );
  }
  it("reuses an open checkout and creates a monthly flexible subscription only when needed", async () => {
    hostReplies(
      [],
      [
        {
          mode: "subscription",
          metadata: { pindou_price: price.id },
          url: "https://checkout.stripe.com/existing",
        },
      ],
    );
    expect(await (await checkout(checkoutRequest())).json()).toEqual({
      url: "https://checkout.stripe.com/existing",
    });
    expect(transport).toHaveBeenCalledTimes(6);
    transport.mockClear();
    hostReplies();
    replies({ url: "https://checkout.stripe.com/new" });
    expect((await checkout(checkoutRequest())).status).toBe(200);
    const body = new URLSearchParams(
      String(transport.mock.calls.at(-1)?.[1]?.body),
    );
    expect(body.get("line_items[0][price]")).toBe(price.id);
    expect(body.get("line_items[0][quantity]")).toBe("1");
    expect(body.get("subscription_data[billing_mode][type]")).toBe("flexible");
    expect(body.get("success_url")).toBe(
      "https://studio.example/account/plus?checkout=complete",
    );
  });
  it("does not sell another subscription while a payment needs recovery", async () => {
    replies(
      { id: "host" },
      [],
      price,
      { stripe_customer_id: "cus_host" },
      { data: [{ ...subscription, status: "past_due" }] },
    );
    expect((await checkout(checkoutRequest())).status).toBe(409);
    expect(transport).toHaveBeenCalledTimes(5);
  });
  it("labels sandbox pricing as test mode", async () => {
    replies(price);
    expect(
      await (
        await status(new Request("https://studio.example/api/billing/status"))
      ).json(),
    ).toMatchObject({
      configured: true,
      active: false,
      testMode: true,
      pricing: { amount: 490, currency: "sgd" },
    });
  });
});
