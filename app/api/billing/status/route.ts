import {
  account,
  admin,
  configured,
  entitled,
  json,
  replyError,
  stripe,
} from "@/lib/server/services";
import { CALL_POLICY } from "@/lib/call-policy";
export async function GET(request: Request) {
  if (!configured())
    return json({ configured: false, active: false, policy: CALL_POLICY });
  try {
    const price = await stripe().prices.retrieve(
      process.env.STRIPE_PLUS_PRICE_ID!,
    );
    if (
      !price.active ||
      price.type !== "recurring" ||
      price.recurring?.interval !== "month" ||
      price.recurring.interval_count !== 1 ||
      price.unit_amount === null ||
      price.unit_amount <= 0
    )
      throw new Error("Monthly price required");
    const pricing = {
      amount: price.unit_amount,
      currency: price.currency,
      interval: "month",
    };
    if (!request.headers.has("authorization"))
      return json({
        configured: true,
        active: false,
        pricing,
        policy: CALL_POLICY,
      });
    const user = await account(request),
      active = await entitled(user.id);
    const month = new Date();
    month.setUTCDate(1);
    month.setUTCHours(0, 0, 0, 0);
    const { count, error } = await admin()
      .from("call_sessions")
      .select("id", { count: "exact", head: true })
      .eq("host_user_id", user.id)
      .gte("created_at", month.toISOString());
    if (error) throw error;
    return json({
      configured: true,
      active,
      email: user.email,
      remaining: Math.max(0, CALL_POLICY.sessionsPerMonth - (count ?? 0)),
      pricing,
      policy: CALL_POLICY,
    });
  } catch (e) {
    return replyError(e);
  }
}
