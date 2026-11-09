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
    assert.equal(school.driverPrefix, 'NPS');
  } finally { Institute.exists = original; }
});

test('school prefixes use initials or the whole single word without numbers', () => {
  assert.equal(schoolDriverPrefix('KG Reddy College of Engineering and Technology'), 'KRCOEAT');
  assert.equal(schoolDriverPrefix('jbiet'), 'JBIET');
  assert.equal(schoolDriverPrefix('CIVIL-MECH & EEE BLOCK'), 'CMEB');
  assert.equal(schoolDriverPrefix('School 123'), 'SCHOOL');
  assert.equal(schoolDriverPrefix('New School', 1), 'NSN');
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
  assert.equal(writes[1].update.$set.driverPrefix, 'NS');
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


test('unused generated prefixes become name-only while issued IDs remain stable', async () => {
  const writes = [];
  const Model = {
    find: () => ({ select: () => ({ lean: async () => [
      { _id: 'unused', name: 'jbiet', driverPrefix: 'J83D05A58', driverSequence: 0 },
      { _id: 'issued', name: 'Existing School', driverPrefix: 'ES1234ABCD', driverSequence: 2 },
    ] }) }),
    updateOne: async (filter, update) => writes.push({ filter, update }),
  };
  await activateRegisteredSchools(Model);
  assert.equal(writes[0].update.$set.driverPrefix, 'JBIET');
  assert.deepEqual(writes[0].filter.driverSequence, { $in: [0, null] });
  assert.equal(writes[1].update.$set.driverPrefix, undefined);
});
