import test from "node:test";
import assert from "node:assert/strict";
import { quoteForDistance, roundMonthlyTotal } from "../services/bookingPricing.js";

test("monthly price includes an additional child charge for each child after the first", () => {
  const oneChild = quoteForDistance(5, "AUTO", 1);
  const twoChildren = quoteForDistance(5, "AUTO", 2);
  const threeChildren = quoteForDistance(5, "AUTO", 3);

  assert.equal(oneChild.childCount, 1);
  assert.equal(oneChild.additionalChildCharge, 0);
  assert.equal(oneChild.ratePerKm, 16);
  assert.equal(oneChild.distanceCharge, 4189.52);
  assert.equal(oneChild.platformFee, 209.48);
  assert.equal(oneChild.platformFeeRate, 0.05);
  assert.equal(oneChild.totalMonthly, 4399);
  assert.equal(twoChildren.childCount, 2);
  assert.equal(twoChildren.additionalChildCharge, 500);
  assert.equal(twoChildren.totalMonthly, 4899);
  assert.equal(threeChildren.additionalChildCharge, 1000);
  assert.equal(threeChildren.totalMonthly, 5499);
});

test('hundred brackets preserve zero-ending and 99-ending prices exactly', () => {
  for (const [input, expected] of [[4368,4399],[4893,4899],[5200,5200],[5470,5470],[5000,5000],[4999,4999],[4999.01,5099],[5470.01,5499],[0.01,99]]) assert.equal(roundMonthlyTotal(input), expected);
});

test('van rates and displayed components match the charged amount to the paise', () => {
  assert.equal(quoteForDistance(5, 'VAN').ratePerKm, 18);
  assert.equal(quoteForDistance(5, 'VAN').totalMonthly, 4999);
  for (const vehicle of ['AUTO', 'VAN']) for (const distance of [0.1, 0.71, 5, 7.23, 12]) for (const children of [1,2,3]) {
    const q = quoteForDistance(distance,vehicle,children);
    assert.equal(Math.round((q.distanceCharge+q.additionalChildCharge)*100),Math.round(q.rideSubtotal*100));
    assert.ok(Math.abs(Math.round(q.rideSubtotal*0.05*100)-Math.round(q.platformFee*100)) <= 1);
    assert.equal(Math.round((q.rideSubtotal+q.platformFee)*100),Math.round(q.totalMonthly*100));
  }
});

test('legacy bookings retain their original prices and platform fee', () => {
  const q = quoteForDistance(5, 'AUTO', 1, 26, 'legacy');
  assert.equal(q.totalMonthly,3712.8);
  assert.equal(q.platformFeeRate,0.02);
});

test("booking price rejects invalid child counts and vehicle types", () => {
  assert.throws(() => quoteForDistance(5, "AUTO", 0), /Invalid pricing inputs/);
  assert.throws(() => quoteForDistance(5, "BUS", 2), /Vehicle type must be AUTO or VAN/);
});
