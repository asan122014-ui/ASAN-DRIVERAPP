import { createHash } from 'node:crypto';
export const MAX_RECIPIENTS = 2000;
export function announcementError(message, status = 400) { const error = new Error(message); error.status = status; return error; }
export function validateAudience(input = {}) {
  if (!['parent', 'driver'].includes(input.recipientType)) throw announcementError('Choose parents or drivers.');
  if (!['all', 'selected'].includes(input.scope)) throw announcementError('Choose all or selected recipients.');
  const ids = input.recipientIds ?? [];
  if (!Array.isArray(ids) || ids.length > MAX_RECIPIENTS || ids.some(id => typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id))) throw announcementError('Invalid recipient selection.');
  const recipientIds = [...new Set(ids.map(id => id.toLowerCase()))].sort();
  if (input.scope === 'selected' && !recipientIds.length) throw announcementError('Select at least one recipient.');
  if (input.scope === 'all' && recipientIds.length) throw announcementError('Clear selected recipients when choosing everyone.');
  return { recipientType: input.recipientType, scope: input.scope, recipientIds };
}
export function validateAnnouncement(input = {}) {
  const audience = validateAudience(input);
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  const message = typeof input.message === 'string' ? input.message.trim() : '';
  if (!title || title.length > 120) throw announcementError('Enter a title of 1–120 characters.');
  if (!message || message.length > 2000) throw announcementError('Enter a message of 1–2,000 characters.');
  if (Buffer.byteLength(title + message, 'utf8') > 3000) throw announcementError('This message is too large for a push notification. Please shorten it.');
  if (!/^[a-f\d-]{36}$/i.test(input.requestId || '')) throw announcementError('Invalid send request. Refresh the page and retry.');
  if (!/^[a-f\d]{64}$/i.test(input.audienceHash || '')) throw announcementError('Review the recipients before sending.');
  return { ...audience, title, message, requestId: input.requestId, audienceHash: input.audienceHash };
}
export const hashValue = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const audienceHash = (type, ids) => hashValue([type, [...ids].map(String).sort()]);
export function pushDeliveryState(row, now = Date.now()) {
  if (!row.tokenCount) return 'no_device';
  if (row.acceptedCount >= row.tokenCount) return 'accepted';
  if (row.acceptedCount + row.failedCount >= row.tokenCount) return row.acceptedCount ? 'partial' : 'failed';
  if (new Date(row.expiresAt).getTime() <= now) return row.acceptedCount ? 'partial' : 'expired';
  return row.acceptedCount ? 'partial_pending' : 'pending';
}
