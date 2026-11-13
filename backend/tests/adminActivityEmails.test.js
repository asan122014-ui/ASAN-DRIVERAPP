import test from 'node:test';
import assert from 'node:assert/strict';
import { activityFromChange, safeBusinessFields, indiaMonth, monthBounds, nextMonth, reportPdf } from '../services/adminActivityPolicy.js';
import { recordActivity, deliverAdminEmails, queueMonthlyReport } from '../jobs/deliverAdminActivityEmails.js';

test('sensitive fields and nested secrets never reach the email', () => {
  assert.deepEqual(safeBusinessFields({ name: 'Asha', email: 'a@example.com', password: 'SECRET', otp: '123456', fcmToken: 'SECRET', documents: { url: 'private' } }), { name: 'Asha', email: 'a@example.com' });
  const change = { ns: { coll: 'institute_records' }, operationType: 'update', documentKey: { _id: '1' }, fullDocument: { data: { secret: 'private' } }, updateDescription: { updatedFields: { 'data.document.private-url': 'secret' } } };
  assert.deepEqual(activityFromChange(change).changedFields, ['data']);
  assert.equal(JSON.stringify(activityFromChange(change)).includes('secret'), false);
});
test('GPS, login tokens, email queue updates and existing enquiry sends are excluded', () => {
  const update = fields => ({ ns: { coll: 'drivers' }, operationType: 'update', updateDescription: { updatedFields: fields } });
  assert.equal(activityFromChange(update({ fcmToken: 'x', updatedAt: 'now', 'location.coordinates': [1, 2] })), null);
  assert.equal(activityFromChange({ ns: { coll: 'websiteenquiries' }, operationType: 'insert' }), null);
  assert.equal(activityFromChange({ ns: { coll: 'admin_email_outbox' }, operationType: 'insert' }), null);
  assert.equal(activityFromChange(update({ status: 'approved' })).entity, 'Driver');
  assert.equal(activityFromChange({ ns: { coll: 'parents' }, operationType: 'delete', documentKey: { _id: '123' } }).recordId, '123');
});
test('India month boundaries include midnight correctly and roll across years', () => {
  assert.equal(indiaMonth(new Date('2026-11-30T18:29:59Z')), '2026-11');
  assert.equal(indiaMonth(new Date('2026-11-30T18:30:00Z')), '2026-12');
  assert.equal(monthBounds('2026-11').end.toISOString(), '2026-11-30T18:30:00.000Z');
  assert.equal(nextMonth('2026-12'), '2027-01');
});
test('PDF has multiple pages, escapes content and correct cross-reference positions', () => {
  const pdf = reportPdf(['Monthly report (ASAN)', ...Array.from({ length: 100 }, (_, i) => `Line ${i}`)]).toString();
  assert.match(pdf, /\/Count 3/);
  assert.ok(pdf.includes('Monthly report \\(ASAN\\)'));
  const xref = Number(pdf.match(/startxref\n(\d+)/)[1]);
  assert.equal(pdf.slice(xref, xref + 4), 'xref');
});
test('a change is queued before checkpointing and uses a stable replay identifier', async () => {
  const calls = [];
  const db = { collection: name => ({ updateOne: async (...args) => calls.push({ name, args }) }) };
  const event = { _id: { token: 1 }, ns: { coll: 'parents' }, operationType: 'insert', fullDocument: { name: 'Test', password: 'secret' }, documentKey: { _id: 'parent1' } };
  await recordActivity(db, event); await recordActivity(db, event);
  assert.deepEqual(calls.slice(0, 3).map(call => call.name), ['admin_activity_events', 'admin_email_outbox', 'admin_email_state']);
  assert.deepEqual(calls[1].args[0], calls[4].args[0]);
  assert.equal(JSON.stringify(calls).includes('secret'), false);
});
test('provider failure saves a retry and does not mark the job sent', async () => {
  const writes = []; let claimed = false;
  const db = { collection: () => ({
    findOneAndUpdate: async () => claimed ? null : (claimed = true, { _id: 'test', lease: 'lease', attempts: 1, createdAt: new Date(), message: {} }),
    updateOne: async (filter, update) => writes.push(update),
  }) };
  await deliverAdminEmails(db, async () => { throw Object.assign(new Error('EMAIL_HTTP_429'), { retryable: true }); });
  assert.equal(writes[0].$set.status, 'pending');
  assert.equal(writes[0].$set.lastError, 'EMAIL_HTTP_429');
});
test('monthly PDF is addressed to both recipients and queued with a unique month key', async () => {
  const writes = [];
  const db = { collection: () => ({ aggregate: () => ({ toArray: async () => [] }), countDocuments: async () => 0, updateOne: async (filter, update) => writes.push({ filter, update }) }) };
  await queueMonthlyReport(db, '2026-11', new Date('2026-11-13'));
  assert.equal(writes[0].filter._id, 'monthly-2026-11');
  const message = writes[0].update.$setOnInsert.message;
  assert.deepEqual(message.to, ['saiakshith1415@gmail.com', 'abhilash.kgrc@gmail.com']);
  assert.equal(Buffer.from(message.attachments[0].content, 'base64').subarray(0, 4).toString(), '%PDF');
});
