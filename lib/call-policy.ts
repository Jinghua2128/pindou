export const CALL_POLICY = {
  sessionsPerMonth: 5,
  minutesPerSession: 30,
  maxParticipants: 4,
} as const;
export function hasPaidAccess(
  subscription: {
    status: string;
    price_id: string;
    current_period_end: string;
  } | null,
  priceId: string,
  now = Date.now(),
) {
  return (
    !!subscription &&
    !!priceId &&
    subscription.status === "active" &&
    subscription.price_id === priceId &&
    Date.parse(subscription.current_period_end) > now
  );
}
export function callPermissions(mode: "voice" | "video") {
  return {
    canSend: mode === "voice" ? ["audio"] : ["audio", "video"],
    canAdmin: false,
  };
}
