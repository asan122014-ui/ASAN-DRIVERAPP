import test from "node:test";
import assert from "node:assert/strict";
import Booking from "../models/Booking.js";
import Child from "../models/Child.js";
import { removeCancelledBookingChildren } from "../services/cancelledBookingChildren.js";

const query = (value) => ({ select: () => ({ lean: async () => value }) });
test("removes only cancelled-booking profiles unused by other ongoing bookings", async (t) => {
  t.mock.method(Booking, "find", () => query([{ childIds: ["shared"] }]));
  const selected = t.mock.method(Child, "find", (filter) => {
    assert.deepEqual(filter._id.$in, ["unused"]);
    assert.equal(filter.parentId, "parent");
    assert.equal(filter.activeBookingId, null);
    return query([{ _id: "unused" }]);
  });
  const deleted = t.mock.method(Child, "deleteMany", async () => ({ deletedCount: 1 }));
  assert.deepEqual(await removeCancelledBookingChildren({ _id: "booking", parentId: "parent", status: "cancelled", childId: "shared", childIds: ["shared", "unused"] }), ["unused"]);
  assert.equal(selected.mock.callCount(), 1);
  assert.equal(deleted.mock.callCount(), 1);
});
test("does not touch profiles for a booking that is not cancelled", async (t) => {
  const deleted = t.mock.method(Child, "deleteMany");
  assert.deepEqual(await removeCancelledBookingChildren({ status: "active", childId: "child" }), []);
  assert.equal(deleted.mock.callCount(), 0);
});
test("supports legacy single-child bookings and repeat cleanup", async (t) => {
  t.mock.method(Booking, "find", () => query([]));
  t.mock.method(Child, "find", () => query([]));
  const deleted = t.mock.method(Child, "deleteMany");
  assert.deepEqual(await removeCancelledBookingChildren({ _id: "booking", parentId: "parent", status: "cancelled", childId: "child" }), []);
  assert.equal(deleted.mock.callCount(), 0);
});
