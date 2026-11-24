import mongoose from 'mongoose';
import Parent from '../models/Parent.js';
import Child from '../models/Child.js';
import Booking from '../models/Booking.js';
import Invoice from '../models/Invoice.js';
import Trips from '../models/Trips.js';
import { instituteParentTrackingAccess } from '../institute/parentTrackingAccess.js';
import { instituteBillingMonth } from '../institute/fixedFees.js';

export function eligibleRegularChildren(children, bookings, invoices, trips, now = new Date()) {
  return children.filter(child => {
    const id = String(child._id);
    const started = trips.some(trip => String(trip.parent) === String(child.parentId) && String(trip.child) === id && trip.driverId === child.driverId && trip.status === 'in_transit' && trip.startTime && !trip.endTime);
    if (!started) return false;
    if (child.activeBookingId) return bookings.some(booking => String(booking._id) === String(child.activeBookingId) &&
      String(booking.parentId) === String(child.parentId) && booking.assignedDriverId === child.driverId &&
      booking.status === 'active' && (booking.paidAt || booking.couponAppliedAt) &&
      booking.serviceStartsAt && booking.serviceEndsAt && new Date(booking.serviceStartsAt) <= now && new Date(booking.serviceEndsAt) > now &&
      [...(booking.childIds || []), booking.childId].filter(Boolean).map(String).includes(id));
    // Legacy monthly invoice users still need their own confirmed payment and active trip.
    return invoices.some(invoice => String(invoice.childId) === id && String(invoice.parentId) === String(child.parentId) &&
      invoice.driverId === child.driverId && invoice.status === 'Paid' && invoice.paymentStatus === 'Success' && invoice.month === instituteBillingMonth(now));
  });
}

export async function trackingChildren(parent, { driverId, childId, now = new Date() } = {}) {
  if (!parent?._id || parent.isActive === false || !driverId) return [];
  if (childId && !mongoose.Types.ObjectId.isValid(childId)) return [];
  const filter = { parentId: parent._id, driverId, ...(childId ? { _id: childId } : {}) };
  if (parent.accountSource === 'institute') Object.assign(filter, { accountSource: 'institute', instituteId: parent.instituteId });
  else filter.accountSource = { $ne: 'institute' };
  const children = await Child.find(filter).select('_id parentId driverId activeBookingId assignedRouteName status location dropLocationCoords').lean();
  if (!children.length) return [];
  if (parent.accountSource === 'institute') {
    const access = await instituteParentTrackingAccess(parent, { children, driverId, childId, now });
    return children.filter(child => access.get(String(child._id))?.canTrack);
  }
  const ids = children.map(child => child._id);
  const [bookings, invoices, trips] = await Promise.all([
    Booking.find({ parentId: parent._id, assignedDriverId: driverId, _id: { $in: children.map(child => child.activeBookingId).filter(Boolean) }, status: 'active' }).lean(),
    Invoice.find({ parentId: parent._id, childId: { $in: ids }, driverId, month: instituteBillingMonth(now), status: 'Paid', paymentStatus: 'Success' }).select('parentId childId driverId month status paymentStatus').lean(),
    Trips.find({ parent: parent._id, child: { $in: ids }, driverId, status: 'in_transit', startTime: { $ne: null }, endTime: null }).select('parent child driverId status startTime endTime').lean(),
  ]);
  return eligibleRegularChildren(children, bookings, invoices, trips, now);
}

export async function sendTrackingLocation(io, driverId, payload, validateSession) {
  const sockets = await io.in(`tracking:${driverId}`).fetchSockets();
  for (const socket of sockets) {
    try {
      const user = socket.user || socket.data.user;
      if (user?.role !== 'parent') continue;
      await validateSession(socket.data.sessionToken);
      const parent = await Parent.findById(user.parentId).select('_id isActive accountSource instituteId').lean();
      if (!(await trackingChildren(parent, { driverId })).length) { socket.leave(`tracking:${driverId}`); continue; }
      socket.emit('live_location', payload);
    } catch { socket.leave(`tracking:${driverId}`); }
  }
}
