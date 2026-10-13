import test from "node:test";
import assert from "node:assert/strict";
import DriverRequest from "../models/DriverRequest.js";
import { adminOfferDeadline, expireAdminOffers } from "../services/adminOfferExpiry.js";

test("admin offers expire exactly one hour after assignment", () => {
  assert.equal(adminOfferDeadline(new Date("2026-10-13T10:00:00Z")).toISOString(), "2026-10-13T11:00:00.000Z");
});

test("expiry unlocks pending offers and cannot overwrite an accepted request", async () => {
  const originals = { find: DriverRequest.find, updateMany: DriverRequest.updateMany, updateOne: DriverRequest.updateOne };
  const events = [];
  try {
    DriverRequest.updateMany = async (filter) => { assert.equal(filter.requestType, "new_driver"); };
    DriverRequest.find = (filter) => {
      assert.equal(filter.status, "Pending"); assert.equal(filter.matchingStatus, "Offered");
      assert.equal(filter.requestType, "new_driver"); assert.ok(filter.offerExpiresAt.$lte instanceof Date);
      return { select: () => ({ limit: async () => [{ _id: "expired", bookingId: "booking" }, { _id: "accepted", bookingId: "booking2" }] }) };
    };
    DriverRequest.updateOne = async (filter, pipeline) => {
      assert.equal(filter.status, "Pending"); assert.equal(filter.matchingStatus, "Offered");
      const update = pipeline[0].$set;
      assert.equal(update.matchingStatus, "Searching"); assert.deepEqual(update.currentOfferDriverIds, []);
      assert.equal(update.offerExpiresAt, null); assert.ok(update.delayedDriverIds.$setUnion);
      return { modifiedCount: filter._id === "expired" ? 1 : 0 };
    };
    await expireAdminOffers({ to: () => ({ emit: (event, payload) => events.push({ event, payload }) }) });
    assert.equal(events.length, 1); assert.equal(events[0].payload.requestId, "expired");
  } finally { Object.assign(DriverRequest, originals); }
});
