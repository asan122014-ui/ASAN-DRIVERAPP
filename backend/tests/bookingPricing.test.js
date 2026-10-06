import test from "node:test";
import assert from "node:assert/strict";
import { quoteForDistance } from "../services/bookingPricing.js";

test("monthly price includes an additional child charge for each child after the first", () => {
  const oneChild = quoteForDistance(5, "AUTO", 1);
  const twoChildren = quoteForDistance(5, "AUTO", 2);
  const threeChildren = quoteForDistance(5, "AUTO", 3);

  assert.equal(oneChild.childCount, 1);
  assert.equal(oneChild.additionalChildCharge, 0);
  assert.equal(oneChild.totalMonthly, 3712.8);
  assert.equal(twoChildren.childCount, 2);
  assert.equal(twoChildren.additionalChildCharge, 500);
  assert.equal(twoChildren.totalMonthly, 4222.8);
  assert.equal(threeChildren.additionalChildCharge, 1000);
  assert.equal(threeChildren.totalMonthly, 4732.8);
});

test("booking price rejects invalid child counts and vehicle types", () => {
  assert.throws(() => quoteForDistance(5, "AUTO", 0), /Invalid pricing inputs/);
  assert.throws(() => quoteForDistance(5, "BUS", 2), /Vehicle type must be AUTO or VAN/);
});
