import Notification from '../models/Notification.js';
import PushDelivery from '../models/PushDelivery.js';
import Parent from '../models/Parent.js';
import Driver from '../models/Driver.js';

export const reminderWindowMs = 3 * 24 * 60 * 60 * 1000;
export function serviceHasEnded(booking, now = new Date()) {
  return booking.status === 'expired' || (booking.serviceEndsAt && new Date(booking.serviceEndsAt).getTime() <= now.getTime());
}
export function isPaidService(booking) {
  return Boolean(booking.paidAt || booking.couponAppliedAt);
}

// Store inbox messages and push jobs in the same transaction as the transition.
// Repeated worker runs cannot produce duplicate expiry/reminder messages.
export async function queueServiceNotice(booking, event, session) {
  const ended = event === 'ended';
  const date = new Date(booking.serviceEndsAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' });
  const optedOut = booking.renewalDecision === 'end';
  const notices = [];
  const recipients = [{ kind: 'parent', account: await Parent.findById(booking.parentId).select('fcmTokens').session(session) }];
  if (ended && booking.assignedDriverId) recipients.push({ kind: 'driver', account: await Driver.findOne({ driverId: booking.assignedDriverId }).select('fcmTokens').session(session) });
  for (const { kind, account } of recipients) {
    if (!account) continue;
    const title = ended ? 'Monthly ride service ended' : 'Your monthly ride ends soon';
    const message = kind === 'driver'
      ? `The monthly booking ended on ${date}. Further rides need a new confirmed booking.`
      : ended
        ? `Your paid service ended on ${date}. ${optedOut ? 'You chose to end after this month.' : 'Open your previous booking to continue the ride or end after this month.'} Your booking and payment history remain available.`
        : `Your monthly ride ends on ${date}. ${optedOut ? 'You chose to end after this month.' : 'Open your booking to review your service and choose whether to continue after it ends.'} No automatic payment will be taken.`;
    const [notice] = await Notification.create([{ ...(kind === 'parent' ? { parent: booking.parentId } : { driver: booking.assignedDriverId }), recipientType: kind, title, message, type: 'general', notificationKey: ended ? 'BOOKING_SERVICE_ENDED' : 'BOOKING_SERVICE_ENDING', meta: { bookingId: String(booking._id) } }], { session });
    const tokens = [...new Set((account.fcmTokens || []).filter(token => typeof token === 'string' && token.trim()))];
    for (let offset = 0; offset < tokens.length; offset += 500) {
      await PushDelivery.create([{ recipientType: kind, tokens: tokens.slice(offset, offset + 500), notification: { title, body: message }, data: { bookingId: String(booking._id), notificationId: String(notice._id), notificationKey: notice.notificationKey, type: 'general', recipientType: kind } }], { session });
    }
    notices.push(notice);
  }
  return notices;
}
