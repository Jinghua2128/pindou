import {
  account,
  admin,
  entitled,
  json,
  origin,
  replyError,
  ServiceError,
  stripe,
} from "@/lib/server/services";
import { roomBody } from "@/lib/room-request";
export async function POST(request: Request) {
  try {
    await roomBody(request);
    const user = await account(request),
      db = admin(),
      payments = stripe();
    if (await entitled(user.id))
      throw new ServiceError(
        "Your subscription is already active. Use Manage subscription.",
        409,
      );
    const price = await payments.prices.retrieve(
      process.env.STRIPE_PLUS_PRICE_ID!,
    );
    if (
      !price.active ||
      price.recurring?.interval !== "month" ||
      price.recurring.interval_count !== 1 ||
      price.unit_amount === null ||
      price.unit_amount <= 0
    )
      throw new ServiceError(
        "A monthly subscription price must be configured.",
        503,
      );
    const { data, error } = await db
      .from("billing_customers")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    let customer = data?.stripe_customer_id;
    if (!customer) {
      const created = await payments.customers.create(
        { email: user.email, metadata: { user_id: user.id } },
        { idempotencyKey: `pindou-customer-${user.id}` },
      );
      customer = created.id;
      const saved = await db
        .from("billing_customers")
        .upsert(
          { user_id: user.id, stripe_customer_id: customer },
          { onConflict: "user_id" },
        );
      if (saved.error) throw saved.error;
    }
    // Webhooks can lag behind Checkout. Also check Stripe before selling another plan.
    const subscriptions = await payments.subscriptions.list({
      customer,
      status: "all",
      limit: 100,
    });
    if (
      subscriptions.data.some(
        (s) =>
          [
            "active",
            "trialing",
            "past_due",
            "unpaid",
            "incomplete",
            "paused",
          ].includes(s.status) &&
          s.items.data.some((i) => i.price.id === price.id),
      )
    ) {
      throw new ServiceError(
        "A subscription already exists. Refresh your status or use Manage subscription.",
        409,
      );
    }
    // Reuse an open checkout: repeated clicks cannot create parallel subscriptions.
    const sessions = await payments.checkout.sessions.list({
      customer,
      status: "open",
      limit: 10,
    });
    const existing = sessions.data.find(
      (s) => s.mode === "subscription" && s.metadata?.pindou_price === price.id,
    );
    if (existing?.url) return json({ url: existing.url });
    const session = await payments.checkout.sessions.create(
      {
        mode: "subscription",
        customer,
        line_items: [{ price: price.id, quantity: 1 }],
        success_url: `${origin()}/account/plus?checkout=complete`,
        cancel_url: `${origin()}/account/plus`,
        client_reference_id: user.id,
        metadata: { pindou_price: price.id },
        subscription_data: { metadata: { user_id: user.id } },
      },
      {
        idempotencyKey: `pindou-checkout-${user.id}-${price.id}-${Math.floor(Date.now() / 600000)}`,
      },
    );
    return json({ url: session.url });
  } catch (e) {
    return replyError(e);
  }
}
