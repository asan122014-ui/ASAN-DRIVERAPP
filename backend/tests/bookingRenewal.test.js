import test from 'node:test';
import assert from 'node:assert/strict';
import { renewalDetails } from '../services/bookingRenewalPolicy.js';
import { renewBooking } from '../services/renewBooking.js';
import { quoteForDistance } from '../services/bookingPricing.js';

const past = new Date('2026-10-01T00:00:00Z');
const child = { name: 'Child', age: 10, school: 'School', grade: '5' };
const source = () => ({ _id: 'previous', parentId: 'owner', status: 'expired', paidAt: past, serviceEndsAt: past, assignedDriverId: 'ASAN-EXISTING', child, children: [child], route: { pickup: 'Home', dropoff: 'School', pickupTime: '07:00', schoolPickupTime: '15:30', pickupCoordinates: { lat: 17, lng: 78 }, dropoffCoordinates: { lat: 17.1, lng: 78.1 }, distanceKm: 2, durationMinutes: 15 }, quote: { vehicleType: 'AUTO', workingDays: 26, totalMonthly: 0 } });

test('renewal copies saved family and route but recomputes price without copying a waiver', () => {
  const previous = source();
  previous.children = [child, { ...child, name: 'Sibling' }];
  const details = renewalDetails(previous);
  assert.equal(details.children.length, 2);
  assert.deepEqual(details.route, previous.route);
  assert.equal(details.quote.totalMonthly, quoteForDistance(2, 'AUTO', 2, 26).totalMonthly);
  assert.ok(details.quote.totalMonthly > 0);
  assert.equal(details.couponAppliedAt, undefined);
});

test('renewal rejects unpaid, cancelled, ongoing, missing-driver and incomplete saved bookings', () => {
  for (const changes of [
    { paidAt: null }, { status: 'cancelled' },
    { status: 'active', serviceEndsAt: new Date('2100-01-01') },
    { assignedDriverId: '' }, { children: [{ ...child, age: 18 }] },
    { route: { ...source().route, pickupCoordinates: null } },
  ]) assert.throws(() => renewalDetails({ ...source(), ...changes }), error => error.status === 409);
});

function setup({ driverAvailable = true, ongoing = [] } = {}) {
  const saved = source();
  const rows = [saved];
  const requests = [];
  const query = value => ({ session: async () => value });
  const models = {
    Booking: {
      init: async () => {},
      findOne: filter => query(rows.find(row => row.parentId === filter.parentId && (filter._id ? row._id === filter._id : row.renewedFromBookingId === filter.renewedFromBookingId))),
      find: () => query(ongoing),
      updateOne: async () => {},
      create: async ([data]) => { const row = { ...data, _id: 'renewal', save: async () => {} }; rows.push(row); return [row]; },
    },
    Driver: { findOne: () => query(driverAvailable ? { driverId: 'ASAN-EXISTING' } : null) },
    Child: { findOne: () => query({ _id: 'child' }), updateOne: async () => {} },
    DriverRequest: { create: async ([data]) => { requests.push(data); return [{ _id: 'request' }]; } },
  };
  const session = async () => ({ withTransaction: async callback => callback(), endSession: async () => {} });
  return { models, session, rows, requests };
}

test('repeat Continue taps reuse one unpaid renewal with the previous accepted driver', async () => {
  const state = setup();
  const first = await renewBooking({ _id: 'owner' }, 'previous', state.models, state.session);
  const second = await renewBooking({ _id: 'owner' }, 'previous', state.models, state.session);
  assert.equal(first._id, second._id);
  assert.equal(state.rows.length, 2);
  assert.equal(state.requests.length, 1);
  assert.equal(first.status, 'awaiting_payment');
  assert.equal(first.assignedDriverId, 'ASAN-EXISTING');
  assert.equal(first.paidAt, undefined);
  assert.equal(state.requests[0].matchingStatus, 'Accepted');
  assert.equal(state.rows[0].status, 'expired');
});

test('foreign parents, unavailable drivers and overlapping current bookings cannot create renewals', async () => {
  for (const [options, owner] of [[{}, 'other'], [{ driverAvailable: false }, 'owner'], [{ ongoing: [{ child, status: 'awaiting_payment' }] }, 'owner']]) {
    const state = setup(options);
    await assert.rejects(renewBooking({ _id: owner }, 'previous', state.models, state.session), error => [404, 409].includes(error.status));
    assert.equal(state.rows.length, 1);
  }
});
