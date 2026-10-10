import test from "node:test";
import assert from "node:assert/strict";
import { canWaiveLocationCharge, validLocationAccessCode } from "../services/developerLocationAccess.js";
import { readFileSync } from "node:fs";
import vm from "node:vm";

test("location waiver requires the authorized account and exact code", () => {
  const developer = { email: "bhattagiri.neeharika@gmail.com" };
  assert.equal(validLocationAccessCode(developer, "Asanrides0"), true);
  assert.equal(validLocationAccessCode({ email: "other@gmail.com" }, "Asanrides0"), false);
  assert.equal(validLocationAccessCode(developer, "asanrides0"), false);
  assert.equal(validLocationAccessCode(developer, ""), false);
  assert.equal(canWaiveLocationCharge({}), false);
  assert.equal(canWaiveLocationCharge({ email: " BHATTAGIRI.NEEHARIKA@gmail.com " }), true);
});

const source = readFileSync(new URL("../routes/childLocationChangeRoutes.js", import.meta.url), "utf8");
const endpoint = source.slice(source.indexOf('router.post("/:requestId/developer-apply"'), source.indexOf('router.post("/:requestId/order"'));

async function runApply({ email = "bhattagiri.neeharika@gmail.com", code = "Asanrides0", order = "", status = "awaiting_payment" } = {}) {
  const request = { status, amountDue: 400.85, distanceChargeDue: 392.99, platformFeeDue: 7.86, driverAmountDue: 392.99, paymentOrderId: order, parentId: "parent", _id: "request", childId: "child", bookingId: "booking" };
  let handler, applied = 0, queried = 0, notifications = 0, event;
  vm.runInNewContext(endpoint, {
    router: { post(path, ...handlers) { handler = handlers.at(-1); } }, verifyParent() {}, validLocationAccessCode, validId: () => true,
    ChildLocationChangeRequest: { async findOne(filter) { queried++; assert.equal(filter.parentId, "parent"); return request; } },
    Child: { async findOne() { return {}; } }, Booking: { async findOne() { return {}; } },
    async applyLocation(value) { applied++; value.status = "completed"; },
    async parentNotification() { notifications++; }, async driverLocationChangeNotice() { notifications++; },
    fail() { throw new Error("Unexpected failure"); }, Date, String,
  });
  let httpStatus = 200, body;
  await handler({ params: { requestId: "request" }, parent: { _id: "parent", email }, body: { code }, app: { get() { return { to() { return { emit(name, data) { event = data; } }; } }; } } }, {
    status(value) { httpStatus = value; return this; }, json(value) { body = value; return value; },
  });
  return { request, applied, queried, notifications, event, httpStatus, body };
}

test("waiver applies the route without recording a payment or payable distance charge", async () => {
  const result = await runApply();
  assert.equal(result.httpStatus, 200);
  assert.equal(result.applied, 1);
  assert.equal(result.notifications, 2);
  assert.equal(result.request.waivedAmount, 400.85);
  for (const field of ["amountDue", "distanceChargeDue", "platformFeeDue", "driverAmountDue"]) assert.equal(result.request[field], 0);
  assert.equal(result.request.paymentId, undefined);
  assert.equal(result.event.status, "completed");
});

test("other accounts and started payments cannot use the waiver", async () => {
  const denied = await runApply({ email: "other@gmail.com" });
  assert.equal(denied.httpStatus, 403);
  assert.equal(denied.queried, 0);
  const payment = await runApply({ order: "order_started" });
  assert.equal(payment.httpStatus, 409);
  assert.equal(payment.applied, 0);
  assert.equal(payment.request.amountDue, 400.85);
});
