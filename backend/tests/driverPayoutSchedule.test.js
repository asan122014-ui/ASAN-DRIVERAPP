import test from "node:test";
import assert from "node:assert/strict";
import { splitDriverPayoutAmount } from "../services/driverPayoutSchedule.js";

test("splits odd-paise totals while preserving the exact driver distance charge", () => {
  assert.deepEqual(splitDriverPayoutAmount(100), [50, 50]);
  assert.deepEqual(splitDriverPayoutAmount(100.01), [50.01, 50]);
  assert.deepEqual(splitDriverPayoutAmount(0), [0, 0]);
});

test("rejects invalid driver payout totals", () => {
  assert.throws(() => splitDriverPayoutAmount(-1), /non-negative/);
  assert.throws(() => splitDriverPayoutAmount(Number.NaN), /non-negative/);
});
