import mongoose from 'mongoose';
import fs from 'node:fs/promises';
mongoose.set('autoIndex', false);
mongoose.set('autoCreate', false);
const { default: Parent } = await import('../models/Parent.js');
const { default: Child } = await import('../models/Child.js');
const { default: Institute } = await import('../institute/models/Institute.js');
const { parentPickup, syncInstituteParentPickup } = await import('../institute/enrollment.js');
const apply = process.argv.includes('--apply');
const backup = process.argv.find(arg => arg.startsWith('--backup='))?.slice(9);
if (apply && !backup) throw new Error('An explicit local backup path is required for --apply.');
if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required.');
const summary = { mode: apply ? 'apply' : 'preview', parents: 0, changedStudents: 0, skippedParents: 0 };
try {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  const backups = [];
  const parents = await Parent.find({ accountSource: 'institute', instituteId: { $ne: null } });
  for (const parent of parents) {
    const institute = await Institute.findById(parent.instituteId);
    if (!institute || institute.name !== parent.instituteName) { summary.skippedParents++; continue; }
    try {
      const pickup = parentPickup(parent);
      const children = await Child.find({ accountSource: 'institute', instituteId: institute._id, parentId: parent._id });
      const changed = children.filter(child => child.pickupLocation !== pickup.address || child.location?.lat !== pickup.point.lat || child.location?.lng !== pickup.point.lng);
      if (!changed.length) continue;
      summary.parents++;
      backups.push(...changed.map(child => ({ id: String(child._id), parentId: String(parent._id), instituteId: String(institute._id), pickupLocation: child.pickupLocation, location: child.location?.toObject?.() || child.location })));
      if (apply) {
        // Save the original locations locally before each transaction writes.
        await fs.writeFile(backup, JSON.stringify(backups, null, 2), { mode: 0o600 });
        const session = await mongoose.startSession();
        let count = 0;
        try { await session.withTransaction(async () => { count = await syncInstituteParentPickup(parent, institute, session); }); }
        finally { await session.endSession(); }
        summary.changedStudents += count;
      } else summary.changedStudents += changed.length;
    } catch (error) {
      if (error.status === 400 || error.status === 409) summary.skippedParents++;
      else throw error;
    }
  }
  console.log(JSON.stringify(summary));
} finally { await mongoose.disconnect(); }
