import test from 'node:test';
import assert from 'node:assert/strict';
import { websiteEnquiryEmail, sendWebsiteEnquiryEmail, enquiryEmailRecipients } from '../services/websiteEnquiryEmail.js';
import { createWebsiteEnquiry } from '../services/createWebsiteEnquiry.js';
import { deliverWebsiteEnquiryEmails } from '../jobs/deliverWebsiteEnquiryEmails.js';
import WebsiteEnquiry from '../models/WebsiteEnquiry.js';

const now = new Date('2026-11-12T08:00:00Z');
const enquiry = { _id: 'saved-id', type: 'parent', name: '<script>unsafe</script>', phone: '9000000000', area: 'Test area', school: 'Test school', pickupLocation: 'Test pickup', dropLocation: 'Test drop', preferredTransport: 'either' };

test('parent notification contains the enquiry, both fixed recipients and escaped HTML', () => {
  const email = websiteEnquiryEmail({ ...enquiry, to: ['untrusted@example.com'] }, now);
  assert.deepEqual(email.to, ['saiakshith1415@gmail.com', 'abhilash.kgrc@gmail.com']);
  assert.equal(email.from, 'ASAN Rides <notifications@asanrides.com>');
  assert.match(email.subject, /parent website enquiry/);
  assert.match(email.text, /Test pickup/); assert.match(email.text, /Test drop/); assert.match(email.text, /Auto or van/);
  assert.doesNotMatch(email.html, /<script>/); assert.match(email.html, /&lt;script&gt;/);
  assert.match(email.text, /IST/);
});

test('driver notification shows vehicle and experience without unrelated parent details', () => {
  const email = websiteEnquiryEmail({ ...enquiry, type: 'driver', vehicleType: 'van', vehicleNumber: 'TS00AA0000', experience: '3-5' }, now);
  assert.match(email.subject, /driver website enquiry/); assert.match(email.text, /TS00AA0000/);
  assert.match(email.text, /3-5 years/); assert.doesNotMatch(email.text, /Test school|Test pickup/);
});

test('enquiry and email are saved in one write, independently of worker availability', async () => {
  let saved = false;
  class Model {
    constructor(data) { Object.assign(this, data, { _id: 'new-id' }); }
    async save() {
      assert.equal(this.emailNotification.status, 'pending');
      assert.deepEqual(this.emailNotification.message.to, enquiryEmailRecipients);
      saved = true;
    }
  }
  const result = await createWebsiteEnquiry(enquiry, Model, () => { throw new Error('Worker temporarily unavailable'); });
  assert.equal(result._id, 'new-id'); assert.ok(saved);
  assert.equal(new WebsiteEnquiry(enquiry).emailNotification, undefined, 'existing records do not acquire queued mail by default');
});

test('an unsuccessful database save cannot trigger an email', async () => {
  let woken = false;
  class Model { constructor(data) { Object.assign(this, data); } async save() { throw new Error('Database unavailable'); } }
  await assert.rejects(createWebsiteEnquiry(enquiry, Model, () => { woken = true; }), /Database unavailable/);
  assert.equal(woken, false);
});

function queue(attempts = 1) {
  const updates = [];
  let claims = 0;
  const Model = {
    updateMany: async () => {},
    findOneAndUpdate: (filter, update) => ({ lean: async () => ++claims === 1 ? {
      _id: 'enquiry-123', emailNotification: { attempts, message: websiteEnquiryEmail(enquiry, now), leaseId: update.$set['emailNotification.leaseId'] },
    } : null }),
    updateOne: async (filter, update) => { updates.push({ filter, update }); },
  };
  return { Model, updates };
}

test('worker records provider acceptance using a stable enquiry idempotency key and owned lease', async () => {
  const state = queue();
  await deliverWebsiteEnquiryEmails({ Model: state.Model, now: () => now, send: async (message, key) => {
    assert.equal(key, 'website-enquiry/enquiry-123'); assert.deepEqual(message.to, enquiryEmailRecipients); return 'provider-id';
  } });
  const result = state.updates[0];
  assert.ok(result.filter['emailNotification.leaseId']);
  assert.equal(result.update.$set['emailNotification.status'], 'sent');
  assert.equal(result.update.$set['emailNotification.providerMessageId'], 'provider-id');
});

test('temporary failure retries without altering the saved enquiry; permanent errors stop', async () => {
  for (const [retryable, attempts, status] of [[true, 1, 'pending'], [false, 1, 'failed'], [true, 10, 'failed']]) {
    const state = queue(attempts);
    await deliverWebsiteEnquiryEmails({ Model: state.Model, now: () => now, send: async () => { throw Object.assign(new Error('EMAIL_HTTP_503'), { retryable }); } });
    assert.equal(state.updates[0].update.$set['emailNotification.status'], status);
    assert.ok(Object.keys(state.updates[0].update.$set).every(key => key.startsWith('emailNotification.')));
    assert.ok(state.updates[0].update.$set['emailNotification.availableAt'] > now);
  }
});

test('Resend request uses existing server credentials, a timeout and stable idempotency', async () => {
  let request;
  const id = await sendWebsiteEnquiryEmail(websiteEnquiryEmail(enquiry, now), 'website-enquiry/id', { apiKey: 'test-only', fetchEmail: async (url, options) => {
    request = options; assert.equal(url, 'https://api.resend.com/emails'); return { ok: true, json: async () => ({ id: 'accepted-id' }) };
  } });
  assert.equal(id, 'accepted-id'); assert.equal(request.headers['Idempotency-Key'], 'website-enquiry/id');
  assert.ok(request.signal); assert.deepEqual(JSON.parse(request.body).to, enquiryEmailRecipients);
});

test('Resend rate limits are retried, but invalid authentication fails explicitly', async () => {
  for (const [status, retryable] of [[429, true], [503, true], [403, false]]) {
    await assert.rejects(sendWebsiteEnquiryEmail({}, 'same-key', { apiKey: 'test-only', fetchEmail: async () => ({ ok: false, status, json: async () => ({}) }) }), error => error.retryable === retryable);
  }
});
