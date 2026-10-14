export const couponExpiresAt = new Date("2026-11-15T18:30:00.000Z");
export function canUseParentCoupon(parent, now = new Date()) {
  const emails = new Set(String(process.env.PARENT_COUPON_EMAILS || "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
  return now.getTime() < couponExpiresAt.getTime() && emails.has(String(parent?.email || "").trim().toLowerCase());
}
export function validParentCoupon(parent, code, now = new Date()) {
  return canUseParentCoupon(parent, now) && String(code || "").trim() === "Asanrides0";
}
export function assertCouponBooking(booking, paymentStarted) {
  if (!booking || booking.status !== "awaiting_payment" || !booking.assignedDriverId || paymentStarted) {
    const error = new Error("Coupon requires an accepted booking with no payment attempt. Resolve any existing payment first."); error.status = 409; throw error;
  }
}
