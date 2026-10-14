import test from "node:test";
import assert from "node:assert/strict";
import { canUseParentCoupon, validParentCoupon, assertCouponBooking, couponExpiresAt } from "../services/parentPaymentCoupon.js";
process.env.PARENT_COUPON_EMAILS = "first@example.com, SECOND@example.com";
test("coupon is restricted to the configured parent emails and exact code", () => {
  const now = new Date("2026-10-14T00:00:00Z");
  assert.equal(validParentCoupon({ email: " FIRST@example.com " }, "Asanrides0", now), true);
  assert.equal(validParentCoupon({ email: "second@example.com" }, "asanrides0", now), false);
  assert.equal(validParentCoupon({ email: "other@example.com" }, "Asanrides0", now), false);
  assert.equal(canUseParentCoupon({}, now), false);
});
test("coupon expires at midnight after November 15 in India", () => {
  assert.equal(validParentCoupon({ email: "first@example.com" }, "Asanrides0", new Date(couponExpiresAt.getTime()-1)), true);
  assert.equal(validParentCoupon({ email: "first@example.com" }, "Asanrides0", couponExpiresAt), false);
  assert.equal(canUseParentCoupon({ email: "first@example.com" }, new Date("2026-11-16T00:00:00Z")), false);
});
test("missing allowlist fails closed", () => {
  const value = process.env.PARENT_COUPON_EMAILS;
  delete process.env.PARENT_COUPON_EMAILS;
  try { assert.equal(canUseParentCoupon({email:"first@example.com"}), false); }
  finally { process.env.PARENT_COUPON_EMAILS = value; }
});
test("coupon cannot bypass driver acceptance or an existing payment attempt", () => {
  const booking = { status: "awaiting_payment", assignedDriverId: "ASAN-TEST" };
  assert.doesNotThrow(() => assertCouponBooking(booking, false));
  assert.throws(() => assertCouponBooking(booking, true), /existing payment/);
  for (const status of ["cancelled", "active", "awaiting_driver", "driver_searching"]) assert.throws(() => assertCouponBooking({...booking,status},false));
});
