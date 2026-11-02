// Non-destructive, idempotent migration. Defaults to a report; requires --apply.
// Credentials are read locally, never printed or included in command arguments.
import fs from 'node:fs';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { isDeepStrictEqual } from 'node:util';

const args = process.argv.slice(2);
const option = flag => args[args.indexOf(flag) + 1];
if (!args.includes('--source-env') || !args.includes('--target-env')) throw new Error('Provide --source-env and --target-env file paths.');
const sourceEnv = dotenv.parse(fs.readFileSync(option('--source-env')));
const targetEnv = dotenv.parse(fs.readFileSync(option('--target-env')));
const source = await mongoose.createConnection(sourceEnv.MONGODB_URI, { serverSelectionTimeoutMS: 10000 }).asPromise();
const target = await mongoose.createConnection(targetEnv.MONGO_URI, { serverSelectionTimeoutMS: 10000 }).asPromise();
const mapping = { institutes: 'institutes', users: 'institute_users', records: 'institute_records', demo_enquiries: 'institute_demo_enquiries' };
const report = [];
try {
  if (source.name === target.name && source.host === target.host) throw new Error('Source and target must be different databases.');
  const data = [];
  for (const [from, to] of Object.entries(mapping)) {
    const rows = await source.db.collection(from).find({}).toArray();
    let existing = 0;
    for (const row of rows) {
      const previous = await target.db.collection(to).findOne({ _id: row._id });
      if (previous) {
        if (!isDeepStrictEqual(previous, row)) throw new Error(`Conflicting record in ${to}; nothing will be overwritten.`);
        existing++;
      }
    }
    data.push({ from, to, rows });
    report.push({ from, to, total: rows.length, alreadyCopied: existing });
  }
  if (args.includes('--apply')) {
    for (const { to } of data) {
      const exists = await target.db.listCollections({ name: to }, { nameOnly: true }).hasNext();
      if (!exists) await target.db.createCollection(to);
    }
    const session = await target.startSession();
    try {
      await session.withTransaction(async () => {
        for (const { to, rows } of data) {
          if (rows.length) await target.db.collection(to).bulkWrite(rows.map(row => ({ updateOne: {
            filter: { _id: row._id }, update: { $setOnInsert: row }, upsert: true
          } })), { session });
        }
      });
    } finally { await session.endSession(); }
    for (const { from, rows } of data) {
      const current = await source.db.collection(from).find({}).toArray();
      if (!isDeepStrictEqual(current, rows)) throw new Error('Source changed during migration. Stop cutover and reconcile before using the destination.');
    }
  }
  console.log(JSON.stringify({ mode: args.includes('--apply') ? 'copied' : 'report-only', sourceDatabase: source.name,
    targetDatabase: target.name, collections: report, sourcePreserved: true }, null, 2));
} finally { await Promise.all([source.close(), target.close()]); }
