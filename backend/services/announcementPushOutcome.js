import mongoose from 'mongoose';
import PushDelivery from '../models/PushDelivery.js';
import AnnouncementDelivery from '../models/AnnouncementDelivery.js';

// Update the queue and its durable reporting together. A retry of this commit
// cannot count the same Firebase response twice after the job has changed.
export async function commitAnnouncementPushOutcome(job, { invalid, retry }, acceptedCount) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const filter = { _id: job._id, attempts: job.attempts, tokens: job.tokens };
      let changed;
      if (retry.length) {
        const result = await PushDelivery.updateOne(filter, { $set: { tokens: retry, availableAt: new Date(Date.now() + Math.min(300000, 1000 * 2 ** Math.min(job.attempts, 8))) } }, { session });
        changed = result.modifiedCount;
      } else changed = (await PushDelivery.deleteOne(filter, { session })).deletedCount;
      if (changed) await AnnouncementDelivery.updateOne({ _id: job.announcementDeliveryId }, { $inc: { acceptedCount, failedCount: invalid.length } }, { session });
    });
  } finally { await session.endSession(); }
}
