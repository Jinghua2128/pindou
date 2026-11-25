import {
  account,
  admin,
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
    const user = await account(request);
    const { data, error } = await admin()
      .from("billing_customers")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();
    if (error || !data)
      throw new ServiceError("No subscription account found.", 404);
    const session = await stripe().billingPortal.sessions.create({
      customer: data.stripe_customer_id,
      return_url: `${origin()}/account/plus`,
    });
    return json({ url: session.url });
  } catch (e) {
    return replyError(e);
  }
}
