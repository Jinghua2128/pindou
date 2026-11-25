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
    let subscription: string | { id: string } | null | undefined;
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        subscription = event.data.object.id;
        break;
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
      case "checkout.session.async_payment_failed":
        subscription = event.data.object.subscription;
        break;
      case "invoice.paid":
      case "invoice.payment_failed":
      case "invoice.payment_action_required":
        subscription =
          event.data.object.parent?.subscription_details?.subscription;
        break;
    }
    if (subscription) {
      // Read the authoritative current subscription instead of applying potentially out-of-order event status.
      const sub = await payments.subscriptions.retrieve(
        typeof subscription === "string" ? subscription : subscription.id,
        { expand: ["latest_invoice"] },
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
        // An active subscription can still have a pending asynchronous payment.
        const paid =
          typeof sub.latest_invoice === "object" &&
          sub.latest_invoice?.status === "paid";
        const saved = await db.rpc("apply_subscription", {
          p_id: sub.id,
          p_user: owner.data.user_id,
          p_status: sub.status,
          p_price: item?.price.id ?? "",
          p_end: new Date(
            (paid ? (item?.current_period_end ?? 0) : 0) * 1000,
          ).toISOString(),
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
