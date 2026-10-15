import test from "node:test";
import assert from "node:assert/strict";
import Parent from "../models/Parent.js";
import Driver from "../models/Driver.js";
import Notification from "../models/Notification.js";
import PushDelivery from "../models/PushDelivery.js";
import { deliverBookingNotice, notifyBookingStatus } from "../services/bookingNotifications.js";

test("parent notice queues deduplicated FCM tokens and emits in-app notice", async (t) => {
  t.mock.method(Parent, "findById", () => ({ select: async () => ({ fcmTokens: ["token", "token", ""] }) }));
  const queued = t.mock.method(PushDelivery, "insertMany", async () => []);
  const events = [];
  await deliverBookingNotice({ _id: "notice", parent: "parent", recipientType: "parent", notificationKey: "BOOKING_DRIVER_ACCEPTED", title: "Accepted", message: "Pay to activate", type: "driver_request_accepted", meta: { bookingId: "booking", monthlyPrice: 30 } }, { to: (room) => ({ emit: (event) => events.push({ room, event }) }) });
  const job = queued.mock.calls[0].arguments[0][0];
  assert.deepEqual(job.tokens, ["token"]);
  assert.equal(job.recipientType, "parent");
  assert.equal(job.data.monthlyPrice, "30");
  assert.equal(job.data.bookingId, "booking");
  assert.deepEqual(events, [{ room: "parent", event: "notification" }]);
});

test("driver cancellation is persisted and queued to driver Firebase", async (t) => {
  const details = { driver: "ASAN-TEST", recipientType: "driver", notificationKey: "BOOKING_CANCELLED", title: "Cancelled", message: "Parent cancelled", type: "general" };
  const saved = t.mock.method(Notification, "create", async (value) => ({ _id: "notice", ...value }));
  t.mock.method(Driver, "findOne", () => ({ select: async () => ({ fcmTokens: ["driver-token"] }) }));
  const queued = t.mock.method(PushDelivery, "insertMany", async () => []);
  await notifyBookingStatus(details);
  assert.equal(saved.mock.callCount(), 1);
  assert.equal(queued.mock.calls[0].arguments[0][0].recipientType, "driver");
});

test("an account without tokens still gets its in-app event", async (t) => {
  t.mock.method(Parent, "findById", () => ({ select: async () => ({ fcmTokens: [] }) }));
  const queued = t.mock.method(PushDelivery, "insertMany", async () => []);
  let emitted = false;
  await deliverBookingNotice({ parent: "parent", recipientType: "parent" }, { to: () => ({ emit: () => { emitted = true; } }) });
  assert.ok(emitted);
  assert.equal(queued.mock.callCount(), 0);
});
