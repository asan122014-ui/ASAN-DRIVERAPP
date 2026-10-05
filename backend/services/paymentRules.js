import crypto from "node:crypto";

export function monthlyAmount(booking) {
  const distance = Number(booking.route?.distanceKm);
  const vehicle = booking.quote?.vehicleType;
  const children = Number(booking.quote?.childCount);
  if (!Number.isFinite(distance) || distance <= 0 || !["AUTO", "VAN"].includes(vehicle) || !Number.isInteger(children) || children < 1) throw new Error("Invalid booking price inputs");
  return Math.round((distance * 2 * (vehicle === "AUTO" ? 14 : 16) * 26 + (children - 1) * 500) * 1.02 * 100) / 100;
}

export function verifySignature(rawBody, timestamp, signature, secret) {
  if (!Buffer.isBuffer(rawBody) || !timestamp || !signature || !secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(String(timestamp)).update(rawBody).digest("base64");
  const received = Buffer.from(String(signature));
  const computed = Buffer.from(expected);
  return received.length === computed.length && crypto.timingSafeEqual(received, computed);
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

export function confirmedPayment(order, payments, expected) {
  if (order.order_id !== expected.orderId || order.order_status !== "PAID" || order.order_currency !== "INR" || Math.round(Number(order.order_amount) * 100) !== Math.round(expected.amount * 100)) return null;
  return payments.find((payment) => payment.payment_status === "SUCCESS" && payment.payment_currency === "INR" && Math.round(Number(payment.payment_amount) * 100) === Math.round(expected.amount * 100) && payment.cf_payment_id) || null;
}
