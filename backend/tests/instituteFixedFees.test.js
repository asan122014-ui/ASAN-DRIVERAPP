import test from 'node:test';
import assert from 'node:assert/strict';
import { fixedMonthlyAmount, instituteBillingMonth } from '../institute/fixedFees.js';
test('fixed monthly fees accept INR precision and reject missing, zero, negative and malformed amounts', () => {
  assert.equal(fixedMonthlyAmount('2500.50'), 2500.5);
  assert.equal(fixedMonthlyAmount(100), 100);
  for (const amount of [undefined, null, '', '0', -1, '12.345', '1e3', '2500x', Infinity, '1000000.01']) assert.throws(() => fixedMonthlyAmount(amount));
});
test('Institute billing month follows India time at month boundaries', () => {
  assert.equal(instituteBillingMonth(new Date('2026-11-30T18:29:59Z')), '2026-11');
  assert.equal(instituteBillingMonth(new Date('2026-11-30T18:30:00Z')), '2026-12');
});
