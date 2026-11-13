import mongoose from 'mongoose';
import { createHash, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { activityCollections, activityFromChange, indiaMonth, monthBounds, nextMonth, reportPdf } from '../services/adminActivityPolicy.js';
import { enquiryEmailRecipients, enquiryEmailSender, sendWebsiteEnquiryEmail } from '../services/websiteEnquiryEmail.js';

const iso = value => new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';
const idFor = token => createHash('sha256').update(JSON.stringify(token)).digest('hex');
const baseMessage = (subject, text) => ({ from: enquiryEmailSender, to: [...enquiryEmailRecipients], subject, text });

export async function recordActivity(db, change) {
  const activity = activityFromChange(change);
  const id = idFor(change._id);
  if (activity) {
    await db.collection('admin_activity_events').updateOne({ _id: id }, { $setOnInsert: activity }, { upsert: true });
    const text = [
      `${activity.entity}: ${activity.operation}`, `When: ${iso(activity.occurredAt)}`,
      `Record ID: ${activity.recordId}`,
      ...Object.entries(activity.details).map(([key, value]) => `${key}: ${value}`),
      ...(activity.changedFields.length ? [`Changed fields: ${activity.changedFields.join(', ')}`] : []),
      '', 'Review this activity at https://admin.asanrides.com',
    ].join('\n');
    await db.collection('admin_email_outbox').updateOne({ _id: `activity-${id}` }, { $setOnInsert: {
      message: baseMessage(`ASAN Rides | ${activity.entity} ${activity.operation}`, text),
      status: 'pending', attempts: 0, availableAt: new Date(), createdAt: new Date(),
    } }, { upsert: true });
  }
  // Queue insertion precedes checkpointing: replay safely deduplicates after a restart.
  await db.collection('admin_email_state').updateOne({ _id: 'watch' }, { $set: { resumeToken: change._id, lastEventAt: new Date() } }, { upsert: true });
}

export async function queueMonthlyReport(db, month, coverageStartedAt) {
  const { start, end } = monthBounds(month);
  const groups = await db.collection('admin_activity_events').aggregate([
    { $match: { occurredAt: { $gte: start, $lt: end } } },
    { $group: { _id: { entity: '$entity', operation: '$operation' }, count: { $sum: 1 } } },
    { $sort: { '_id.entity': 1, '_id.operation': 1 } },
  ]).toArray();
  const lines = ['ASAN RIDES', `Monthly operations report - ${month}`, '',
    `Period: ${iso(start)} to ${iso(new Date(end.getTime() - 1))}`,
    `Prepared: ${iso(new Date())}`, '', 'ACTIVITY DURING THE MONTH',
    ...(new Date(coverageStartedAt) > start ? [`Activity email monitoring began ${iso(coverageStartedAt)}.`, 'Activity totals cover only the monitored portion of this month.'] : []),
    ...groups.map(row => `${row._id.entity} / ${row._id.operation}: ${row.count}`),
  ];
  if (!groups.length) lines.push('No monitored business changes recorded.');
  lines.push('', 'NEW RECORDS CREATED DURING THE MONTH');
  for (const [collection, label] of Object.entries(activityCollections)) {
    const count = await db.collection(collection).countDocuments({ createdAt: { $gte: start, $lt: end } });
    lines.push(`${label}: ${count}`);
  }
  // Booking payments are in rupees. Coupon activations are not collected revenue.
  const revenue = await db.collection('bookingpayments').aggregate([
    { $match: { paidAt: { $gte: start, $lt: end }, status: 'PAID', provider: { $ne: 'coupon' }, environment: 'production' } },
    { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amount' } } },
  ]).toArray();
  const coupons = await db.collection('bookingpayments').countDocuments({ createdAt: { $gte: start, $lt: end }, status: 'WAIVED', provider: 'coupon' });
  lines.push('', 'REGULAR BOOKING PAYMENTS', `Confirmed production payments: ${revenue[0]?.count || 0}`,
    `Collected: INR ${(revenue[0]?.amount || 0).toFixed(2)}`, `Coupon activations: ${coupons}`,
    'These are currently paid booking records, not a settlement or accounting statement.',
    'Institute invoices and driver payouts are listed separately as operational activity.',
    '', 'CURRENT PENDING ITEMS AT REPORT GENERATION');
  for (const [collection, filter, label] of [
    ['bookings', { status: { $in: ['awaiting_driver', 'driver_searching'] } }, 'Bookings awaiting a driver'],
    ['bookings', { status: 'awaiting_payment' }, 'Bookings awaiting payment'],
    ['drivers', { status: 'pending' }, 'Drivers awaiting review'],
    ['admin_email_outbox', { status: 'failed' }, 'Email alerts needing attention'],
  ]) lines.push(`${label}: ${await db.collection(collection).countDocuments(filter)}`);
  lines.push('', 'Counts reflect records retained in the database when this report was prepared.',
    'Deleted records remain represented in monitored activity counts.',
    'Manage records at https://admin.asanrides.com');
  const message = baseMessage(`ASAN Rides | Monthly report ${month}`, `Your ASAN Rides monthly report for ${month} is attached. All report dates use India time.`);
  message.attachments = [{ filename: `ASAN-Rides-Monthly-Report-${month}.pdf`, content: reportPdf(lines).toString('base64') }];
  await db.collection('admin_email_outbox').updateOne({ _id: `monthly-${month}` }, { $setOnInsert: {
    message, status: 'pending', attempts: 0, availableAt: new Date(), createdAt: new Date(),
  } }, { upsert: true });
}

export async function deliverAdminEmails(db, send = sendWebsiteEnquiryEmail) {
  for (let count = 0; count < 10; count++) {
    const now = new Date(), lease = randomUUID();
    const job = await db.collection('admin_email_outbox').findOneAndUpdate({
      status: { $in: ['pending', 'processing'] }, availableAt: { $lte: now },
    }, { $set: { status: 'processing', availableAt: new Date(+now + 120000), lease }, $inc: { attempts: 1 } },
    { returnDocument: 'after', sort: { availableAt: 1 } });
    if (!job) break;
    try {
      // Stop automatic retries before Resend's 24-hour idempotency window expires.
      if (+now - +job.createdAt >= 23 * 3600000) throw Object.assign(new Error('EMAIL_RETRY_WINDOW_EXPIRED'), { retryable: false });
      const providerId = await send(job.message, `admin/${job._id}`);
      await db.collection('admin_email_outbox').updateOne({ _id: job._id, lease }, { $set: {
        status: 'sent', sentAt: new Date(), providerId, message: null, lastError: '',
      } });
    } catch (error) {
      const retry = error.retryable !== false && job.attempts < 10;
      await db.collection('admin_email_outbox').updateOne({ _id: job._id, lease }, { $set: {
        status: retry ? 'pending' : 'failed', lastError: /^EMAIL_[A-Z0-9_]+$/.test(error.message) ? error.message : 'EMAIL_NETWORK_ERROR',
        availableAt: new Date(Date.now() + Math.min(1800000, 15000 * 2 ** job.attempts)),
      } });
      console.warn('Admin activity email:', retry ? 'retry_scheduled' : 'delivery_failed');
    }
    await delay(600);
  }
}

export async function startAdminActivityEmails() {
  if (process.env.ADMIN_ACTIVITY_EMAILS_ENABLED === 'false') return;
  const db = mongoose.connection.db;
  await db.collection('admin_email_outbox').createIndex({ status: 1, availableAt: 1 });
  await db.collection('admin_activity_events').createIndex({ occurredAt: 1 });
  await db.collection('admin_email_state').updateOne({ _id: 'monthly' }, { $setOnInsert: {
    nextMonth: indiaMonth(), coverageStartedAt: new Date(),
  } }, { upsert: true });
  // Establish a durable starting timestamp before opening the first stream.
  const hello = await db.command({ hello: 1 });
  await db.collection('admin_email_state').updateOne({ _id: 'watch' }, { $setOnInsert: { startAt: hello.operationTime } }, { upsert: true });
  const watch = async () => {
    while (mongoose.connection.readyState === 1) {
      let stream;
      try {
        const state = await db.collection('admin_email_state').findOne({ _id: 'watch' });
        stream = db.watch([{ $match: { 'ns.coll': { $in: Object.keys(activityCollections) }, operationType: { $in: ['insert', 'update', 'replace', 'delete'] } } }], {
          fullDocument: 'updateLookup', maxAwaitTimeMS: 15000,
          ...(state.resumeToken ? { resumeAfter: state.resumeToken } : { startAtOperationTime: state.startAt }),
        });
        while (mongoose.connection.readyState === 1) {
          const change = await stream.tryNext();
          if (change) await recordActivity(db, change);
          else if (stream.resumeToken) await db.collection('admin_email_state').updateOne({ _id: 'watch' }, { $set: {
            resumeToken: stream.resumeToken, lastEventAt: new Date(),
          } });
        }
      } catch (error) {
        // Never silently discard a failed resume token and skip business activity.
        console.error('Admin activity monitoring unavailable:', error.codeName || error.code || 'WATCH_FAILED');
      } finally { await stream?.close().catch(() => {}); }
      await delay(30000);
    }
  };
  void watch();
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      const state = await db.collection('admin_email_state').findOne({ _id: 'monthly' });
      const current = indiaMonth();
      // First run after the month closes also catches up following a server restart.
      if (state.nextMonth < current && Date.now() >= +monthBounds(current).start + 300000) {
        await queueMonthlyReport(db, state.nextMonth, state.coverageStartedAt);
        await db.collection('admin_email_state').updateOne({ _id: 'monthly', nextMonth: state.nextMonth }, { $set: { nextMonth: nextMonth(state.nextMonth) } });
      }
      await deliverAdminEmails(db);
    } catch { console.error('Admin email/report worker unavailable; pending jobs remain saved.'); }
    finally { busy = false; }
  };
  void tick();
  const timer = setInterval(tick, 15000); timer.unref();
  return timer;
}
