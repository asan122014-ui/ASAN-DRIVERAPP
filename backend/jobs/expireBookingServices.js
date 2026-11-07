import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Child from '../models/Child.js';
import Parent from '../models/Parent.js';
import { queueServiceNotice, reminderWindowMs } from '../services/bookingServiceLifecycle.js';

export async function processBookingServiceLifecycle(io, now = new Date()) {
  const candidates = await Booking.find({ status: 'active', serviceEndsAt: { $lte: new Date(now.getTime() + reminderWindowMs), $ne: null }, $or: [{ serviceEndsAt: { $lte: now } }, { serviceReminderAt: null }] }).sort({ serviceEndsAt: 1 }).select('_id').limit(100);
  for (const candidate of candidates) {
    const session = await mongoose.startSession();
    let changed;
    let notices = [];
    try {
      await session.withTransaction(async () => {
        changed = null; notices = [];
        const booking = await Booking.findOne({ _id: candidate._id, status: 'active' }).session(session);
        if (!booking) return;
        if (booking.serviceEndsAt <= now) {
          booking.status = 'expired';
          await booking.save({ session });
          await Child.updateMany({ activeBookingId: booking._id }, { $set: { driverId: '', activeBookingId: null } }, { session });
          const remaining = await Child.countDocuments({ parentId: booking.parentId, driverId: booking.assignedDriverId }).session(session);
          if (!remaining) await Parent.updateOne({ _id: booking.parentId, driverId: booking.assignedDriverId }, { $set: { driverId: '' } }, { session });
          notices = await queueServiceNotice(booking, 'ended', session);
          changed = booking;
        } else if (!booking.serviceReminderAt) {
          booking.serviceReminderAt = now;
          await booking.save({ session });
          notices = await queueServiceNotice(booking, 'ending', session);
        }
      });
      for (const notice of notices) io?.to(String(notice.recipientType === 'parent' ? notice.parent : notice.driver)).emit('notification', notice.toObject());
      if (changed) {
        const payload = { bookingId: String(changed._id), status: 'expired' };
        io?.to(String(changed.parentId)).emit('booking_status_updated', payload);
        io?.to(changed.assignedDriverId).emit('booking_status_updated', payload);
      }
    } finally { await session.endSession(); }
  }
}
export function startBookingServiceExpiryWorker(io) {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await processBookingServiceLifecycle(io); }
    catch (error) { console.error('BOOKING SERVICE EXPIRY ERROR', error.message); }
    finally { running = false; }
  };
  tick();
  const timer = setInterval(tick, 60000);
  timer.unref();
  return timer;
}
