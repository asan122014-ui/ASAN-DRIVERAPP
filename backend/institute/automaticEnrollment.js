import { randomBytes } from 'node:crypto';

export function schoolDriverPrefix(name, suffix = randomBytes(4).toString('hex')) {
  const words = String(name || '').toUpperCase().match(/[A-Z0-9]+/g) || [];
  const initials = words.map(word => word[0]).join('').replace(/^[0-9]+/, '').slice(0, 4) || 'SCH';
  return `${initials}${suffix.toUpperCase()}`;
}

// Idempotent startup migration: preserve issued prefixes and sequence counters.
export async function activateRegisteredSchools(Model) {
  const schools = await Model.find({ $or: [
    { managedEnrollmentEnabled: { $ne: true } },
    { driverPrefix: { $exists: false } }, { driverPrefix: null }, { driverPrefix: '' },
  ] }).select('_id name driverPrefix').lean();
  for (const school of schools) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const existing = Boolean(school.driverPrefix);
      const filter = { _id: school._id, driverPrefix: existing ? school.driverPrefix : { $in: [null, ''] } };
      const values = { managedEnrollmentEnabled: true };
      if (!existing) values.driverPrefix = schoolDriverPrefix(school.name);
      try {
        await Model.updateOne(filter, { $set: values });
        break;
      } catch (error) {
        if (error.code !== 11000 || existing || attempt === 4) throw error;
      }
    }
  }
}
