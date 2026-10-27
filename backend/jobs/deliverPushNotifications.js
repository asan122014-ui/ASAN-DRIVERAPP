import PushDelivery from "../models/PushDelivery.js";
import Parent from "../models/Parent.js";
import Driver from "../models/Driver.js";
import { parentMessaging, driverMessaging } from "../config/firebaseAdmin.js";

import { classifyPushResults } from "../services/pushDeliveryResults.js";
import { commitAnnouncementPushOutcome } from '../services/announcementPushOutcome.js';

let wakeWorker;
export function wakePushDeliveryWorker() { if (wakeWorker) setImmediate(wakeWorker); }

export function startPushDeliveryWorker() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      for (let count = 0; count < 20; count++) {
        const now = new Date();
        // A lease lets another instance recover a job after a restart.
        const job = await PushDelivery.findOneAndUpdate(
          { availableAt: { $lte: now }, expiresAt: { $gt: now } },
          { $set: { availableAt: new Date(Date.now() + 120000) }, $inc: { attempts: 1 } },
          { new: true, sort: { availableAt: 1 } }
        ).lean();
        if (!job) break;
        try {
          const messaging = job.recipientType === "parent" ? parentMessaging : driverMessaging;
          if (!messaging) throw new Error("Firebase messaging unavailable");
          const response = await messaging.sendEachForMulticast({
            tokens: job.tokens, notification: job.notification, data: job.data,
            android: { priority: "high", notification: { sound: "default" } },
            apns: { payload: { aps: { sound: "default" } } },
          });
          const { invalid, retry } = classifyPushResults(job.tokens, response.responses);
          // Persist only unsuccessful tokens so successful deliveries aren't retried.
          if (job.announcementDeliveryId) await commitAnnouncementPushOutcome(job, { invalid, retry }, response.responses.filter(result => result.success).length);
          else if (retry.length) await PushDelivery.updateOne({ _id: job._id }, { $set: { tokens: retry, availableAt: new Date(Date.now() + Math.min(300000, 1000 * 2 ** Math.min(job.attempts, 8))) } });
          else await PushDelivery.deleteOne({ _id: job._id });
          if (invalid.length) {
            const model = job.recipientType === "parent" ? Parent : Driver;
            await model.updateMany({ fcmTokens: { $in: invalid } }, { $pull: { fcmTokens: { $in: invalid } } });
          }
        } catch (error) {
          console.error("Push delivery deferred:", error.code || "delivery_failed");
          await PushDelivery.updateOne({ _id: job._id }, { $set: { availableAt: new Date(Date.now() + 30000) } });
        }
      }
    } catch (error) { console.error("Push queue worker failed:", error.code || "queue_failed"); }
    finally { running = false; }
  };
  wakeWorker = tick;
  void tick();
  const timer = setInterval(tick, 10000);
  timer.unref();
  return timer;
}
