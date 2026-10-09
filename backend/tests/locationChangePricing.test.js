import test from "node:test";
import assert from "node:assert/strict";
import { priceLocationChange } from "../services/locationChangePricing.js";

test("a longer route charges only the added distance for the remaining service period", () => {
  const result = priceLocationChange({
    oldDistanceKm: 5,
    newDistanceKm: 7,
    vehicleType: "AUTO",
    childCount: 1,
    workingDays: 26,
    serviceStartsAt: "2026-10-01T00:00:00.000Z",
    serviceEndsAt: "2026-10-31T00:00:00.000Z",
    now: "2026-10-16T00:00:00.000Z",
  });
  assert.equal(result.addedDistanceKm, 2);
  assert.equal(result.remainingServiceDays, 13);
  assert.equal(result.extraDistanceDailyCharge, 56);
  assert.equal(result.distanceChargeDue, 728);
  assert.equal(result.platformFeeDue, 14.56);
  assert.equal(result.amountDue, 742.56);
  assert.equal(result.driverAmountDue, 728);
  assert.equal(result.next.distanceCharge - result.previous.distanceCharge, 1456); // Full monthly increase is reserved for renewal pricing.
});

test("a shorter route has no immediate price due and retains a lower renewal price", () => {
  const result = priceLocationChange({ oldDistanceKm: 8, newDistanceKm: 4, vehicleType: "VAN", childCount: 2, workingDays: 26, serviceStartsAt: "2026-10-01T00:00:00.000Z", serviceEndsAt: "2026-10-31T00:00:00.000Z", now: "2026-10-16T00:00:00.000Z" });
  assert.equal(result.amountDue, 0);
  assert.equal(result.driverAmountDue, 0);
  assert.ok(result.next.totalMonthly < result.previous.totalMonthly);
});

test("a route extension at service end is scheduled for the next renewal", () => {
  const result = priceLocationChange({ oldDistanceKm: 5, newDistanceKm: 7, vehicleType: "AUTO", childCount: 1, workingDays: 26, serviceStartsAt: "2026-10-01T00:00:00.000Z", serviceEndsAt: "2026-10-31T00:00:00.000Z", now: "2026-10-31T00:00:00.000Z" });
  assert.equal(result.remainingServiceDays, 0);
  assert.equal(result.amountDue, 0);
  assert.ok(result.next.totalMonthly > result.previous.totalMonthly);
});
