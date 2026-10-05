import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { verifySignature, monthEnd, confirmedPayment, monthlyAmount } from "../services/paymentRules.js";

test("raw webhook bytes must match the signature", () => {
  const raw = Buffer.from('{"amount":10.00}');
  const sig = crypto.createHmac("sha256", "sandbox-test-secret").update("123").update(raw).digest("base64");
  assert.equal(verifySignature(raw, "123", sig, "sandbox-test-secret"), true);
  assert.equal(verifySignature(Buffer.from('{"amount":10}'), "123", sig, "sandbox-test-secret"), false);
  assert.equal(verifySignature(raw, "124", sig, "sandbox-test-secret"), false);
  assert.equal(verifySignature(raw, "123", "bad", "sandbox-test-secret"), false);
});
test("activation needs matching successful amount, currency and order", () => {
  const order = { order_id: "a", order_status: "PAID", order_amount: 100, order_currency: "INR" };
  const payment = { payment_status: "SUCCESS", payment_amount: 100, payment_currency: "INR", cf_payment_id: "p" };
  const expected = { orderId: "a", amount: 100 };
  assert.equal(confirmedPayment(order, [payment], expected), payment);
  for (const changed of [{ payment_amount: 1 }, { payment_currency: "USD" }, { payment_status: "PENDING" }]) assert.equal(confirmedPayment(order, [{ ...payment, ...changed }], expected), null);
  assert.equal(confirmedPayment({ ...order, order_id: "b" }, [payment], expected), null);
  assert.equal(confirmedPayment({ ...order, order_status: "ACTIVE" }, [payment], expected), null);
});
test("calendar month ends clamp correctly", () => {
  assert.equal(monthEnd("2026-01-31T10:00:00Z").toISOString(), "2026-02-28T10:00:00.000Z");
  assert.equal(monthEnd("2028-01-31T10:00:00Z").toISOString(), "2028-02-29T10:00:00.000Z");
  assert.equal(monthEnd("2026-12-05T10:00:00Z").toISOString(), "2027-01-05T10:00:00.000Z");
});
test("checkout recomputes price rather than trusting supplied total", () => {
  const booking = { route: { distanceKm: 5 }, quote: { vehicleType: "AUTO", childCount: 1, totalMonthly: 1 } };
  assert.equal(monthlyAmount(booking), 3712.8);
  assert.throws(() => monthlyAmount({ ...booking, route: { distanceKm: -1 } }));
});
