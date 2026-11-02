import crypto from 'node:crypto';
import mongoose from 'mongoose';
import Record from './models/Record.js';

// Compatibility for operational actions: all reads and writes are scoped to the
// authenticated institute. A transaction prevents a half-saved multi-row action.
export async function readStore(req) {
  const rows = await Record.find({ instituteName: req.user.instituteName }).lean();
  const records = {};
  for (const row of rows) (records[row.module] ??= []).push(row);
  const store = { records };
  req.instituteSnapshot = new Map(rows.map(row => [row.id, JSON.stringify(row)]));
  return store;
}

export async function writeStore(store, req) {
  const snapshot = req.instituteSnapshot;
  if (!snapshot) throw new Error('A scoped snapshot is required.');
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const [module, rows] of Object.entries(store.records)) {
        for (const row of rows) {
          const before = snapshot.get(row.id);
          if (before === JSON.stringify(row)) continue;
          const fields = { data: row.data, stops: row.stops, deviated: row.deviated, deviationAlert: row.deviationAlert };
          if (!before) {
            await Record.create([{ ...fields, id: row.id || crypto.randomUUID(), module,
              instituteName: req.user.instituteName, created: row.created || new Date().toLocaleDateString('en-IN') }], { session });
          } else {
            const original = JSON.parse(before);
            const result = await Record.updateOne({ id: row.id, module,
              instituteName: req.user.instituteName, updatedAt: new Date(original.updatedAt) }, { $set: fields }, { session });
            if (!result.matchedCount) throw Object.assign(new Error('This record changed. Refresh and try again.'), { status: 409 });
          }
        }
      }
    });
  } finally { await session.endSession(); }
}
