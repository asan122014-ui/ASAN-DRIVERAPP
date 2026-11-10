import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Driver from '../models/Driver.js';
import Child from '../models/Child.js';
import DriverRequest from '../models/DriverRequest.js';
import { renewalDetails, renewalError } from './bookingRenewalPolicy.js';
import { overlappingBookingChildren } from './bookingChildOverlap.js';
import { serviceHasEnded } from './bookingServiceLifecycle.js';

export async function renewBooking(parent, sourceId, models = { Booking, Driver, Child, DriverRequest }, startSession = () => mongoose.startSession()) {
  const { Booking: Bookings, Driver: Drivers, Child: Children, DriverRequest: Requests } = models;
  await Bookings.init();
  const session = await startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const source = await Bookings.findOne({ _id: sourceId, parentId: parent._id }).session(session);
      if (!source) throw renewalError('Previous booking not found.', 404);
      const existing = await Bookings.findOne({ renewedFromBookingId: source._id, parentId: parent._id }).session(session);
      if (existing) {
        if (existing.status === 'cancelled') throw renewalError('This renewal was cancelled. Please book a new ride.');
        result = existing;
        return;
      }
      const now = new Date();
      const details = renewalDetails(source, now);
      const driver = await Drivers.findOne({ driverId: source.assignedDriverId, status: 'approved', accountSource: { $ne: 'institute' } }).session(session);
      if (!driver) throw renewalError('Your previous driver is no longer available. Please book a new ride.');
      const ongoing = await Bookings.find({ parentId: parent._id, _id: { $ne: source._id }, status: { $in: ['quoted', 'awaiting_driver', 'driver_searching', 'driver_accepted', 'awaiting_payment', 'active'] } }).session(session);
      if (overlappingBookingChildren(details.children, ongoing.filter(item => !serviceHasEnded(item, now))).length) {
        throw renewalError('These children already have a booking in progress. Open that booking to continue.');
      }
      // Serialize renewals of this booking. The unique source index also protects retries.
      await Bookings.updateOne({ _id: source._id, parentId: parent._id }, { $set: { renewalDecision: 'continue', renewalDecidedAt: now } }, { session });
      const records = [];
      for (const child of details.children) {
        let record = await Children.findOne({ parentId: parent._id, name: child.name, age: child.age, school: child.school, accountSource: { $ne: 'institute' } }).session(session);
        const childDetails = { ...child, pickupTime: details.route.pickupTime, eveningPickup: details.route.schoolPickupTime, pickupLocation: details.route.pickup, dropoffLocation: details.route.dropoff, location: details.route.pickupCoordinates, dropLocationCoords: details.route.dropoffCoordinates, routeDistance: details.route.distanceKm, estimatedDuration: details.route.durationMinutes || 0 };
        if (!record) [record] = await Children.create([{ ...childDetails, parentId: parent._id }], { session });
        else await Children.updateOne({ _id: record._id, parentId: parent._id }, { $set: childDetails }, { session });
        records.push(record);
      }
      const [booking] = await Bookings.create([{ ...details, parentId: parent._id, childId: records[0]._id, childIds: records.map(record => record._id), renewedFromBookingId: source._id, driverChoice: 'existing', requestedDriverId: source.assignedDriverId, assignedDriverId: source.assignedDriverId, status: 'awaiting_payment', startDate: now }], { session });
      const [request] = await Requests.create([{ parentId: parent._id, childId: records[0]._id, bookingId: booking._id, requestType: 'existing_driver', requestedDriverId: source.assignedDriverId, assignedDriverId: source.assignedDriverId, status: 'Assigned', matchingStatus: 'Accepted', notes: `Renewal of booking ${source._id}; continuing with the previously accepted driver.` }], { session });
      booking.driverRequestId = request._id;
      await booking.save({ session });
      result = booking;
    });
    return result;
  } catch (error) {
    if (error.code === 11000) {
      const existing = await Bookings.findOne({ renewedFromBookingId: sourceId, parentId: parent._id, status: { $ne: 'cancelled' } });
      if (existing) return existing;
    }
    throw error;
  } finally { await session.endSession(); }
}
