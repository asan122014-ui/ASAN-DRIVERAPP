import express from 'express';
import mongoose from 'mongoose';
import verifyAdmin, { requireSuperAdmin } from '../middleware/verifyAdmin.js';
import Parent from '../models/Parent.js';
import Driver from '../models/Driver.js';
import Notification from '../models/Notification.js';
import PushDelivery from '../models/PushDelivery.js';
import Announcement from '../models/Announcement.js';
import AnnouncementDelivery from '../models/AnnouncementDelivery.js';
import { wakePushDeliveryWorker } from '../jobs/deliverPushNotifications.js';
import { MAX_RECIPIENTS, announcementError, validateAudience, validateAnnouncement, audienceHash, hashValue, pushDeliveryState } from '../services/announcementPolicy.js';

const router = express.Router();
router.use(verifyAdmin, requireSuperAdmin);
const eligible = type => type === 'parent' ? { isActive: { $ne: false } } : { status: 'approved', driverId: { $type: 'string', $ne: '' } };
const modelFor = type => type === 'parent' ? Parent : Driver;
const fail = (res, error) => { if (!error.status) console.error('Announcement operation failed:', error.code || error.name); return res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Unable to complete the announcement. Please retry.' }); };
async function resolveAudience(input, session) {
  const query = { ...eligible(input.recipientType), ...(input.scope === 'selected' ? { _id: { $in: input.recipientIds } } : {}) };
  const recipients = await modelFor(input.recipientType).find(query).select('_id name email driverId fcmTokens').sort({ _id: 1 }).limit(MAX_RECIPIENTS + 1).session(session || null).lean();
  if (!recipients.length) throw announcementError('No eligible recipients found.');
  if (recipients.length > MAX_RECIPIENTS) throw announcementError(`Send to at most ${MAX_RECIPIENTS} recipients at a time.`);
  if (input.scope === 'selected' && recipients.length !== input.recipientIds.length) throw announcementError('Some recipients are no longer eligible. Review your selection again.', 409);
  return recipients;
}

router.get('/recipients', async (req, res) => {
  try {
    const type = req.query.recipientType;
    if (!['parent', 'driver'].includes(type)) throw announcementError('Choose parents or drivers.');
    const search = String(req.query.search || '').trim().slice(0, 100);
    const filter = eligible(type);
    if (search) { const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); filter.$or = ['name', 'email', 'driverId'].map(field => ({ [field]: { $regex: escaped, $options: 'i' } })); }
    const page = Math.max(1, Math.min(10000, Number.parseInt(req.query.page, 10) || 1));
    const [data, total] = await Promise.all([modelFor(type).find(filter).select('_id name email driverId').sort({ name: 1, _id: 1 }).skip((page - 1) * 30).limit(30).lean(), modelFor(type).countDocuments(filter)]);
    return res.json({ success: true, data, total, page, pages: Math.ceil(total / 30) });
  } catch (error) { return fail(res, error); }
});

router.post('/preview', async (req, res) => {
  try {
    const input = validateAudience(req.body);
    const recipients = await resolveAudience(input);
    return res.json({ success: true, count: recipients.length, audienceHash: audienceHash(input.recipientType, recipients.map(r => r._id)), sample: recipients.slice(0, 8).map(r => ({ name: r.name, email: r.email, driverId: r.driverId })) });
  } catch (error) { return fail(res, error); }
});

router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const [data, total] = await Promise.all([Announcement.find().sort({ createdAt: -1, _id: -1 }).skip((page - 1) * 15).limit(15).lean(), Announcement.countDocuments()]);
    const rows = await AnnouncementDelivery.find({ announcementId: { $in: data.map(item => item._id) } }).select('announcementId tokenCount acceptedCount failedCount expiresAt').lean();
    const groups = new Map(data.map(item => [String(item._id), { inbox: 0, accepted: 0, partial: 0, partial_pending: 0, pending: 0, no_device: 0, failed: 0, expired: 0 }]));
    for (const row of rows) { const stats = groups.get(String(row.announcementId)); stats.inbox++; stats[pushDeliveryState(row)]++; }
    return res.json({ success: true, data: data.map(item => ({ ...item, delivery: groups.get(String(item._id)) })), total, page, pages: Math.ceil(total / 15) });
  } catch (error) { return fail(res, error); }
});

router.post('/', async (req, res) => {
  let session;
  try {
    const input = validateAnnouncement(req.body);
    const payloadHash = hashValue(input);
    const lookup = { adminId: req.admin._id, requestId: input.requestId };
    const previous = await Announcement.findOne(lookup).lean();
    if (previous) { if (previous.payloadHash !== payloadHash) throw announcementError('This send request was already used for a different message.', 409); return res.json({ success: true, data: previous, alreadySent: true }); }
    await Promise.all([Announcement.init(), AnnouncementDelivery.init()]);
    session = await mongoose.startSession();
    let announcement, events;
    await session.withTransaction(async () => {
      events = [];
      const recipients = await resolveAudience(input, session);
      if (audienceHash(input.recipientType, recipients.map(r => r._id)) !== input.audienceHash) throw announcementError('The audience changed. Review recipients again before sending.', 409);
      [announcement] = await Announcement.create([{ ...lookup, payloadHash, title: input.title, message: input.message, recipientType: input.recipientType, scope: input.scope, recipientCount: recipients.length }], { session });
      const notices = [], deliveries = [], jobs = [];
      const expiresAt = new Date(Date.now() + 86400000);
      for (const recipient of recipients) {
        const id = new mongoose.Types.ObjectId();
        const tokens = [...new Set((recipient.fcmTokens || []).filter(token => typeof token === 'string' && token.trim()).map(token => token.trim()))];
        const notice = { _id: id, recipientType: input.recipientType, ...(input.recipientType === 'parent' ? { parent: recipient._id } : { driver: recipient.driverId }), title: input.title, message: input.message, type: 'general', priority: 'low', read: false, createdAt: new Date(), notificationKey: 'ADMIN_ANNOUNCEMENT', meta: { announcementId: String(announcement._id) } };
        notices.push(notice);
        deliveries.push({ _id: id, announcementId: announcement._id, recipientId: recipient._id, recipientType: input.recipientType, recipientName: recipient.name, tokenCount: tokens.length, expiresAt });
        for (let index = 0; index < tokens.length; index += 500) jobs.push({ announcementDeliveryId: id, recipientType: input.recipientType, tokens: tokens.slice(index, index + 500), notification: { title: input.title, body: input.message }, data: { notificationId: String(id), announcementId: String(announcement._id), notificationKey: 'ADMIN_ANNOUNCEMENT', type: 'general', recipientType: input.recipientType }, expiresAt });
        events.push({ room: String(input.recipientType === 'parent' ? recipient._id : recipient.driverId), notice });
      }
      await Notification.insertMany(notices, { session });
      await AnnouncementDelivery.insertMany(deliveries, { session });
      if (jobs.length) await PushDelivery.insertMany(jobs, { session });
    });
    for (const event of events) { try { req.app.get('io')?.to(event.room).emit('notification', event.notice); } catch { /* Persistent inbox remains available after reconnect. */ } }
    wakePushDeliveryWorker();
    return res.status(201).json({ success: true, data: announcement });
  } catch (error) {
    if (error.code === 11000) {
      const input = validateAnnouncement(req.body);
      const previous = await Announcement.findOne({ adminId: req.admin._id, requestId: input.requestId }).lean();
      if (previous && previous.payloadHash === hashValue(input)) return res.json({ success: true, data: previous, alreadySent: true });
      return fail(res, announcementError('This send request is already in use. Refresh the sent history.', 409));
    }
    return fail(res, error);
  } finally { await session?.endSession(); }
});
export default router;
