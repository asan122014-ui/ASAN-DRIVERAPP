import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { verifyCheckoutSignature, monthEnd, confirmedRazorpayPayment, monthlyAmount } from "../services/paymentRules.js";

test("checkout signature must match the stored order and payment ID", () => {
  const sig = crypto.createHmac("sha256", "test-secret").update("order_123|pay_456").digest("hex");
  assert.equal(verifyCheckoutSignature("order_123", "pay_456", sig, "test-secret"), true);
  assert.equal(verifyCheckoutSignature("order_123", "pay_other", sig, "test-secret"), false);
  assert.equal(verifyCheckoutSignature("order_other", "pay_456", sig, "test-secret"), false);
  assert.equal(verifyCheckoutSignature("order_123", "pay_456", "bad", "test-secret"), false);
});
test("activation needs matching successful amount, currency and order", () => {
  const order = { id: "order_a", status: "paid", amount: 10000, currency: "INR" };
  const payment = { id: "pay_p", order_id: "order_a", status: "captured", amount: 10000, currency: "INR" };
  const expected = { orderId: "order_a", amount: 100 };
  assert.equal(confirmedRazorpayPayment(order, [payment], expected), payment);
  for (const changed of [{ amount: 1 }, { currency: "USD" }, { status: "authorized" }, { order_id: "order_b" }]) assert.equal(confirmedRazorpayPayment(order, [{ ...payment, ...changed }], expected), null);
  assert.equal(confirmedRazorpayPayment({ ...order, id: "order_b" }, [payment], expected), null);
  assert.equal(confirmedRazorpayPayment({ ...order, status: "attempted" }, [payment], expected), null);
});
test("calendar month ends clamp correctly", () => {
  assert.equal(monthEnd("2026-01-31T10:00:00Z").toISOString(), "2026-02-28T10:00:00.000Z");
  assert.equal(monthEnd("2028-01-31T10:00:00Z").toISOString(), "2028-02-29T10:00:00.000Z");
  assert.equal(monthEnd("2026-12-05T10:00:00Z").toISOString(), "2027-01-05T10:00:00.000Z");
});
test("checkout recomputes price rather than trusting supplied total", () => {
  const booking = { route: { distanceKm: 5 }, quote: { vehicleType: "AUTO", childCount: 1, totalMonthly: 1 } };
  assert.equal(monthlyAmount(booking), 5304);
  assert.throws(() => monthlyAmount({ ...booking, route: { distanceKm: -1 } }));
});
