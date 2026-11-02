import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import mongoose from 'mongoose';
process.env.INSTITUTE_SESSION_SECRET = 'isolated-test-secret-not-production';
const { default: router } = await import('../institute/router.js');
const { default: User } = await import('../institute/models/User.js');
const { default: Record } = await import('../institute/models/Record.js');
const { default: Institute } = await import('../institute/models/Institute.js');
const { default: Driver } = await import('../models/Driver.js');
const { linkRecord, normalizePhone } = await import('../institute/sharedRecords.js');

const token = (domain = 'institute:') => {
  const payload = Buffer.from(JSON.stringify({ sub: '507f1f77bcf86cd799439011', exp: Date.now() + 60000 })).toString('base64url');
  return `${payload}.${crypto.createHmac('sha256', process.env.INSTITUTE_SESSION_SECRET).update(domain + payload).digest('base64url')}`;
};
test('Institute API remains scoped on the shared database', async t => {
  const ready = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
  Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });
  let role = 'Institute Admin';
  const original = { user: User.findById, records: Record.find, distinct: User.distinct, institutes: Institute.find, driver: Driver.find };
  User.findById = () => ({ lean: async () => ({ _id: '507f1f77bcf86cd799439011', name: 'Staff', role, instituteName: 'School A' }) });
  const app = express(); app.set('trust proxy', false); app.use('/api/institute', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/institute`;
  const call = (path, body, auth = token(), method = body ? 'POST' : 'GET') => fetch(url + path, { method,
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
  try {
    await t.test('rejects unauthenticated private reads', async () => assert.equal((await call('/records/Vehicles', null, '')).status, 401));
    await t.test('rejects legacy and other-app token signatures', async () => assert.equal((await call('/auth/me', null, token(''))).status, 401));
    await t.test('reads only authenticated institute records', async () => {
      Record.find = filter => { assert.deepEqual(filter, { module: 'Vehicles', instituteName: 'School A' }); return { sort: () => ({ lean: async () => [] }) }; };
      const response = await call('/records/Vehicles'); assert.equal(response.status, 200); assert.deepEqual(await response.json(), []);
    });
    await t.test('viewers cannot write even with direct API requests', async () => { role = 'Viewer'; assert.equal((await call('/records/Vehicles', { data: { x: 1 } })).status, 403); role = 'Institute Admin'; });
    await t.test('membership and role cannot be switched by client input', async () => {
      assert.equal((await call('/user/institute', { instituteName: 'School B' })).status, 403);
      assert.equal((await call('/auth/switch-role', { role: 'Transport Manager' })).status, 403);
    });
    await t.test('does not turn simulated payments into real paid rides', async () => assert.equal((await call('/payments/pay', { amount: 100 })).status, 409));
    await t.test('public institute list contains no private access codes', async () => {
      User.distinct = async () => ['School A'];
      Institute.find = () => ({ sort: async () => [{ name: 'School A', code: 'PRIVATE', location: null }] });
      assert.equal(JSON.stringify(await (await call('/institutes', null, '')).json()).includes('PRIVATE'), false);
    });
    await t.test('links drivers by exact email AND phone, without profile writes', async () => {
      Driver.find = filter => { assert.equal(filter.email, 'driver@example.com'); assert.deepEqual(filter.phone.$in, ['9876543210','919876543210','+919876543210']); return { select: () => ({ limit: () => ({ lean: async () => [{ _id: 'existing-driver' }] }) }) }; };
      assert.deepEqual(await linkRecord('Drivers', { Email: 'DRIVER@example.com', 'Phone number': '+91 98765 43210' }, 'School A'), { model: 'Driver', id: 'existing-driver' });
      assert.equal(await linkRecord('Drivers', { 'Driver name': 'Any name' }, 'School A'), null);
      assert.equal(normalizePhone('+91 98765 43210'), '9876543210');
    });
  } finally {
    User.findById = original.user; Record.find = original.records; User.distinct = original.distinct; Institute.find = original.institutes; Driver.find = original.driver;
    if (ready) Object.defineProperty(mongoose.connection, 'readyState', ready); else delete mongoose.connection.readyState;
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
});
