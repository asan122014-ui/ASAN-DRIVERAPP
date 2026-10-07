import test from "node:test";
import assert from "node:assert/strict";
import { priceLocationChange } from "../services/locationChangePricing.js";

test("a longer approved route charges only the monthly price difference", () => {
  const result = priceLocationChange({ oldDistanceKm: 5, newDistanceKm: 7, vehicleType: "AUTO", childCount: 1, workingDays: 26 });
  assert.equal(result.amountDue, Math.round((result.next.totalMonthly - result.previous.totalMonthly) * 100) / 100);
  assert.equal(result.driverAmountDue, Math.round((result.next.distanceCharge - result.previous.distanceCharge) * 100) / 100);
  assert.ok(result.amountDue > result.driverAmountDue); // The parent amount includes the platform charge.
});

test("a shorter route has no immediate price due and retains a lower renewal price", () => {
  const result = priceLocationChange({ oldDistanceKm: 8, newDistanceKm: 4, vehicleType: "VAN", childCount: 2, workingDays: 26 });
  assert.equal(result.amountDue, 0);
  assert.equal(result.driverAmountDue, 0);
  assert.ok(result.next.totalMonthly < result.previous.totalMonthly);
});
