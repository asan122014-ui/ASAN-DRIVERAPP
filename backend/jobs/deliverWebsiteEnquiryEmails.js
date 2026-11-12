import { randomUUID } from 'node:crypto';
import WebsiteEnquiry from '../models/WebsiteEnquiry.js';
import { sendWebsiteEnquiryEmail } from '../services/websiteEnquiryEmail.js';

export async function deliverWebsiteEnquiryEmails({ Model = WebsiteEnquiry, send = sendWebsiteEnquiryEmail, now = () => new Date(), maxJobs = 5 } = {}) {
  await Model.updateMany({ 'emailNotification.status': { $in: ['pending', 'processing'] }, 'emailNotification.deadlineAt': { $lte: now() } }, { $set: { 'emailNotification.status': 'failed', 'emailNotification.lastError': 'EMAIL_RETRY_WINDOW_EXPIRED' } });
  for (let count = 0; count < maxJobs; count++) {
    const leaseId = randomUUID();
    const claimTime = now();
    const job = await Model.findOneAndUpdate({
      'emailNotification.status': { $in: ['pending', 'processing'] },
      'emailNotification.availableAt': { $lte: claimTime }, 'emailNotification.deadlineAt': { $gt: claimTime },
    }, { $set: { 'emailNotification.status': 'processing', 'emailNotification.availableAt': new Date(claimTime.getTime() + 120000), 'emailNotification.leaseId': leaseId }, $inc: { 'emailNotification.attempts': 1 } }, { new: true, sort: { 'emailNotification.availableAt': 1 } }).lean();
    if (!job) break;
    const owned = { _id: job._id, 'emailNotification.status': 'processing', 'emailNotification.leaseId': leaseId };
    const notification = job.emailNotification;
    try {
      const messageId = await send(notification.message, `website-enquiry/${job._id}`);
      await Model.updateOne(owned, { $set: { 'emailNotification.status': 'sent', 'emailNotification.sentAt': now(), 'emailNotification.providerMessageId': messageId, 'emailNotification.lastError': '', 'emailNotification.leaseId': '' } });
    } catch (error) {
      const retry = error.retryable !== false && notification.attempts < 10;
      await Model.updateOne(owned, { $set: {
        'emailNotification.status': retry ? 'pending' : 'failed',
        'emailNotification.availableAt': new Date(now().getTime() + Math.min(1800000, 15000 * 2 ** Math.min(notification.attempts, 7))),
        'emailNotification.lastError': /^EMAIL_[A-Z0-9_]+$/.test(error.message || '') ? error.message : 'EMAIL_NETWORK_ERROR',
        'emailNotification.leaseId': '',
      } });
      console.warn('Website enquiry email deferred:', retry ? 'retry_scheduled' : 'delivery_failed');
    }
  }
}

let wake;
export function wakeWebsiteEnquiryEmailWorker() { if (wake) setImmediate(wake); }
export function startWebsiteEnquiryEmailWorker() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await deliverWebsiteEnquiryEmails(); }
    catch { console.error('Website enquiry email worker unavailable; saved enquiries remain queued.'); }
    finally { running = false; }
  };
  wake = tick;
  void tick();
  const timer = setInterval(tick, 10000); timer.unref();
  return timer;
}
