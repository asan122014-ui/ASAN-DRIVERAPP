import test from 'node:test';
import assert from 'node:assert/strict';
import { serviceHasEnded, isPaidService, reminderWindowMs } from '../services/bookingServiceLifecycle.js';
test('service is not considered ended before the purchased period finishes', () => {
  const now = new Date('2026-11-07T10:00:00Z');
  assert.equal(serviceHasEnded({ status: 'active', serviceEndsAt: '2026-12-07T10:00:00Z' }, now), false);
  assert.equal(serviceHasEnded({ status: 'active', serviceEndsAt: now }, now), true);
  assert.equal(serviceHasEnded({ status: 'expired' }, now), true);
  assert.equal(reminderWindowMs, 3 * 86400000);
});
test('paid and waived services support renewal choices; unpaid requests do not', () => {
  assert.equal(isPaidService({ paidAt: new Date() }), true);
  assert.equal(isPaidService({ couponAppliedAt: new Date() }), true);
  assert.equal(isPaidService({ status: 'awaiting_payment' }), false);
});
