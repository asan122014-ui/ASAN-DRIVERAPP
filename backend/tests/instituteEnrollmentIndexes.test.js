import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeEnrollmentDriver } from '../institute/enrollmentIndexes.js';

function model(index, failure = { code: 86 }) {
  const created = [];
  return { created, init: async () => { throw failure; }, schema: { indexes: () => [[{ driverId: 1 }, { unique: true, sparse: true }], [{ email: 1 }, { unique: true }]] },
    collection: { listIndexes: () => ({ toArray: async () => [index] }), createIndex: async (key, options) => { created.push([key, options]); } } };
}
const legacy = { name: 'driverId_1', key: { driverId: 1 }, unique: true };
test('legacy non-sparse driver ID uniqueness remains intact and other indexes finish', async () => {
  const Driver = model(legacy);
  await initializeEnrollmentDriver(Driver);
  assert.deepEqual(Driver.created, [[{ email: 1 }, { unique: true }]]);
});
test('does not accept missing uniqueness, partial coverage, or unrelated failures', async () => {
  for (const index of [{ ...legacy, unique: false }, { ...legacy, partialFilterExpression: { status: 'approved' } }, { ...legacy, key: { phone: 1 } }]) {
    await assert.rejects(initializeEnrollmentDriver(model(index)));
  }
  await assert.rejects(initializeEnrollmentDriver(model(legacy, { code: 11000 })));
});
test('unrelated index conflicts still stop enrollment', async () => {
  const Driver = model(legacy);
  Driver.collection.createIndex = async () => { throw new Error('Other index conflict'); };
  await assert.rejects(initializeEnrollmentDriver(Driver), /Other index conflict/);
});
