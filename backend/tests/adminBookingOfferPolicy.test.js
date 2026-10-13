import test from "node:test";
import assert from "node:assert/strict";
import { assertAdminOfferAllowed } from "../services/adminBookingOfferPolicy.js";

const request = { requestType: "new_driver", status: "Pending", matchingStatus: "Searching", rejectedDriverIds: [] };
const booking = { driverChoice: "new", status: "driver_searching" };
const driver = { driverId: "ASAN-123456", status: "approved" };
test("admin can offer a pending new-driver booking", () => assert.doesNotThrow(() => assertAdminOfferAllowed(request, booking, driver)));
test("admin cannot redirect a parent's ASAN-ID request", () => assert.throws(() => assertAdminOfferAllowed({ ...request, requestType: "existing_driver" }, { ...booking, driverChoice: "existing" }, driver), /ASAN ID/));
test("cancelled and paid bookings cannot be offered", () => {
  for (const status of ["cancelled", "active", "awaiting_payment", "expired"]) assert.throws(() => assertAdminOfferAllowed(request, { ...booking, status }, driver), /no longer/);
});
test("concurrent assignments cannot replace an outstanding offer", () => assert.throws(() => assertAdminOfferAllowed({ ...request, matchingStatus: "Offered" }, booking, driver), /already reviewing/));
test("admin must choose an approved driver who hasn't declined", () => {
  assert.throws(() => assertAdminOfferAllowed(request, booking, { ...driver, status: "pending" }), /approved/);
  assert.throws(() => assertAdminOfferAllowed({ ...request, rejectedDriverIds: [driver.driverId] }, booking, driver), /declined/);
});
test("a declined request remains assignable to another driver", () => assert.doesNotThrow(() => assertAdminOfferAllowed({ ...request, rejectedDriverIds: ["ASAN-OTHER"] }, booking, driver)));
