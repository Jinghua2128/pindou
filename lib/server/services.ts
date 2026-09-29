import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { hasPaidAccess } from "@/lib/call-policy";
export class ServiceError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function configured() {
  return [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PLUS_PRICE_ID",
    "DAILY_API_KEY",
    "NEXT_PUBLIC_APP_URL",
  ].every((k) => !!process.env[k]);
}
export function requireServices() {
  if (!configured())
    throw new ServiceError(
      "Voice/video subscriptions are not enabled on this studio yet.",
      503,
    );
}
export function admin() {
  requireServices();
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
export function stripe() {
  requireServices();
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}
export async function account(request: Request) {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new ServiceError("Sign in to host a call.", 401);
  const { data, error } = await admin().auth.getUser(token);
  if (error || !data.user) throw new ServiceError("Please sign in again.", 401);
  return data.user;
}
export async function entitled(userId: string) {
  const { data, error } = await admin()
    .from("subscriptions")
    .select("status,price_id,current_period_end")
    .eq("user_id", userId)
    .eq("price_id", process.env.STRIPE_PLUS_PRICE_ID!)
    .eq("status", "active");
  if (error)
    throw new ServiceError(
      "Subscription verification is unavailable. Please try again.",
      503,
    );
  return (data ?? []).some((s) =>
    hasPaidAccess(s, process.env.STRIPE_PLUS_PRICE_ID!),
  );
}
export function origin() {
  const url = new URL(process.env.NEXT_PUBLIC_APP_URL!);
  if (
    url.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(url.hostname)
  )
    throw new ServiceError(
      "Secure hosting must be configured before subscriptions launch.",
      503,
    );
  return url.origin;
}
export function replyError(error: unknown) {
  return Response.json(
    {
      error:
        error instanceof ServiceError
          ? error.message
          : "The service could not complete this request. Please try again.",
    },
    {
      status: error instanceof ServiceError ? error.status : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
export function json(value: unknown) {
  return Response.json(value, { headers: { "Cache-Control": "no-store" } });
}
