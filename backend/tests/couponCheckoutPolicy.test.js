import test from "node:test";
import assert from "node:assert/strict";
import { assertCheckoutCanBeWaived } from "../services/couponCheckoutPolicy.js";
const payment = { provider: "razorpay", orderId: "order_test", status: "ACTIVE" };
test("abandoned or failed unpaid checkouts may use coupon", () => {
  assert.doesNotThrow(() => assertCheckoutCanBeWaived(payment, { id: "order_test", status: "created", amount_paid: 0 }, []));
  assert.doesNotThrow(() => assertCheckoutCanBeWaived({ ...payment, status: "FAILED" }, { id: "order_test", status: "attempted" }, [{ status: "failed" }]));
});
test("authorized, captured, paid and refunded payments stay protected", () => {
  for (const status of ["authorized", "captured"]) assert.throws(() => assertCheckoutCanBeWaived(payment, { id: "order_test" }, [{ status }]), /processing|paid/);
  for (const status of ["PAID", "REFUNDED", "REFUNDING", "REFUND_FAILED"]) assert.throws(() => assertCheckoutCanBeWaived({ ...payment, status }, { id: "order_test" }));
  assert.throws(() => assertCheckoutCanBeWaived(payment, { id: "order_test", amount_paid: 1 }));
});
test("order creation and mismatched orders cannot be waived", () => {
  assert.throws(() => assertCheckoutCanBeWaived({ ...payment, orderId: "pending_test" }, null));
  assert.throws(() => assertCheckoutCanBeWaived(payment, { id: "order_other" }));
});
