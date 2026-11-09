export function schoolDriverPrefix(name, attempt = 0) {
  const words = String(name || '').toUpperCase().match(/[A-Z]+/g) || [];
  const fullName = words.join('') || 'SCHOOL';
  const base = words.length > 1 ? words.map(word => word[0]).join('') : fullName;
  if (!attempt) return base;
  // Resolve an acronym collision with more letters from the school name.
  return base + fullName.slice(0, attempt) + (attempt > fullName.length ? String.fromCharCode(65 + (attempt - fullName.length - 1) % 26) : '');
}

// Idempotent startup migration: preserve issued prefixes and sequence counters.
export async function activateRegisteredSchools(Model) {
  const schools = await Model.find({ $or: [
    { managedEnrollmentEnabled: { $ne: true } },
    { driverSequence: { $in: [0, null] }, driverPrefix: /^[A-Z]{1,4}[A-F0-9]{8}$/ },
    { driverPrefix: { $exists: false } }, { driverPrefix: null }, { driverPrefix: '' },
  ] }).select('_id name driverPrefix driverSequence').lean();
  for (const school of schools) {
    for (let attempt = 0; attempt < 64; attempt++) {
      const replaceGenerated = !school.driverSequence && /^[A-Z]{1,4}[A-F0-9]{8}$/.test(school.driverPrefix || '');
      const existing = Boolean(school.driverPrefix) && !replaceGenerated;
      const filter = { _id: school._id, driverPrefix: school.driverPrefix || { $in: [null, ''] } };
      if (replaceGenerated) filter.driverSequence = { $in: [0, null] };
      const values = { managedEnrollmentEnabled: true };
      if (!existing) values.driverPrefix = schoolDriverPrefix(school.name, attempt);
      try {
        await Model.updateOne(filter, { $set: values });
        break;
      } catch (error) {
        if (error.code !== 11000 || existing || attempt === 63) throw error;
      }
    }
  }
}
