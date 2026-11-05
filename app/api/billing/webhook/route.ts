import { boundedText } from "@/lib/room-request";
import {
  admin,
  json,
  replyError,
  ServiceError,
  stripe,
} from "@/lib/server/services";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const signature = request.headers.get("stripe-signature");
    if (!signature) throw new ServiceError("Missing webhook signature.", 400);
    const payments = stripe();
    let event;
    try {
      event = payments.webhooks.constructEvent(
        await boundedText(request),
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
    } catch {
      throw new ServiceError("Invalid webhook signature.", 400);
    }
    if (
      [
        "customer.subscription.created",
        "customer.subscription.updated",
        "customer.subscription.deleted",
      ].includes(event.type)
    ) {
      // Read the authoritative current subscription instead of applying potentially out-of-order event status.
      const sub = await payments.subscriptions.retrieve(
        (event.data.object as { id: string }).id,
      );
      const customer =
        typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const db = admin(),
        owner = await db
          .from("billing_customers")
          .select("user_id")
          .eq("stripe_customer_id", customer)
          .maybeSingle();
      if (owner.error) throw owner.error;
      if (owner.data) {
        const item = sub.items.data.find(
          (i) => i.price.id === process.env.STRIPE_PLUS_PRICE_ID,
        );
        const saved = await db.rpc("apply_subscription", {
          p_id: sub.id,
          p_user: owner.data.user_id,
          p_status: sub.status,
          p_price: item?.price.id ?? "",
          p_end: new Date((item?.current_period_end ?? 0) * 1000).toISOString(),
          p_event_created: event.created,
        });
        if (saved.error) throw saved.error;
      }
    }
    return json({ received: true });
  } catch (e) {
    return replyError(e);
  }
}
