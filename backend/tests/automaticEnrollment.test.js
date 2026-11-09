import test from 'node:test';
import assert from 'node:assert/strict';
import { activateRegisteredSchools, schoolDriverPrefix } from '../institute/automaticEnrollment.js';
import Institute from '../institute/models/Institute.js';

test('registration automatically activates enrollment and allocates a prefix', async () => {
  const original = Institute.exists;
  Institute.exists = async () => null;
  try {
    const school = new Institute({ name: 'New Public School', code: 'ASAN-123456', adminEmail: 'school@example.com' });
    await school.validate();
    assert.equal(school.managedEnrollmentEnabled, true);
    assert.match(school.driverPrefix, /^NPS[A-F0-9]{8}$/);
  } finally { Institute.exists = original; }
});

test('school prefixes are valid, name-based and distinct for equal names', () => {
  assert.equal(schoolDriverPrefix('KG Reddy College of Engineering', '1234abcd'), 'KRCO1234ABCD');
  for (const name of ['123 School', 'विद्यालय', '', 'A']) {
    assert.match(schoolDriverPrefix(name), /^[A-Z][A-Z0-9]{1,11}$/);
  }
  assert.notEqual(schoolDriverPrefix('Same school', '1234abcd'), schoolDriverPrefix('Same school', '1234abce'));
});

test('existing prefixes are preserved; missing prefixes get automatic setup without resetting IDs', async () => {
  const writes = [];
  const Model = {
    find: () => ({ select: () => ({ lean: async () => [
      { _id: 'old', name: 'Existing School', driverPrefix: 'KGRCET' },
      { _id: 'new', name: 'New School' },
    ] }) }),
    updateOne: async (filter, update) => { writes.push({ filter, update }); },
  };
  await activateRegisteredSchools(Model);
  assert.deepEqual(writes[0], { filter: { _id: 'old', driverPrefix: 'KGRCET' }, update: { $set: { managedEnrollmentEnabled: true } } });
  assert.match(writes[1].update.$set.driverPrefix, /^NS[A-F0-9]{8}$/);
  assert.deepEqual(writes[1].filter.driverPrefix, { $in: [null, ''] });
  assert.ok(writes.every(write => !('driverSequence' in write.update.$set)));
});

test('a prefix collision is retried; database failures are surfaced', async () => {
  let attempts = 0;
  const Model = {
    find: () => ({ select: () => ({ lean: async () => [{ _id: 'new', name: 'School' }] }) }),
    updateOne: async () => { if (++attempts === 1) throw Object.assign(new Error('Duplicate'), { code: 11000 }); },
  };
  await activateRegisteredSchools(Model);
  assert.equal(attempts, 2);
  Model.updateOne = async () => { throw new Error('Database unavailable'); };
  await assert.rejects(activateRegisteredSchools(Model), /Database unavailable/);
});

