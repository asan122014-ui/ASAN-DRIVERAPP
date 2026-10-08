import crypto from "node:crypto";

export function monthlyAmount(booking) {
  const distance = Number(booking.route?.distanceKm);
  const vehicle = booking.quote?.vehicleType;
  const children = Number(booking.quote?.childCount);
  if (!Number.isFinite(distance) || distance <= 0 || !["AUTO", "VAN"].includes(vehicle) || !Number.isInteger(children) || children < 1) throw new Error("Invalid booking price inputs");
  return Math.round((distance * 2 * (vehicle === "AUTO" ? 20 : 30) * 26 + (children - 1) * 500) * 1.02 * 100) / 100;
}

export function verifyCheckoutSignature(orderId, paymentId, signature, secret) {
  if (![orderId, paymentId, signature, secret].every((value) => typeof value === "string" && value.length)) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
}

export function confirmedRazorpayPayment(order, payments, expected) {
  const amountPaise = Math.round(Number(expected.amount) * 100);
  if (order.id !== expected.orderId || order.status !== "paid" || order.currency !== "INR" || order.amount !== amountPaise) return null;
  return payments.find((payment) => payment.order_id === order.id && payment.status === "captured" && payment.currency === "INR" && payment.amount === amountPaise && payment.id) || null;
}

export function monthEnd(start) {
  const result = new Date(start);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}
