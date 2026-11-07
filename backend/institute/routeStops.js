import mongoose from 'mongoose';
import Record from './models/Record.js';
import Child from '../models/Child.js';
import Trips from '../models/Trips.js';
import Parent from '../models/Parent.js';
import Driver from '../models/Driver.js';
import { notice } from './enrollment.js';
import { normalizeStops, effectivePickupMode } from './pickupPolicy.js';
import { enrollmentError } from './enrollmentPolicy.js';
export async function saveRouteStops(user, routeId, input, pickupMode) {
  if (!['Institute Admin', 'Transport Manager'].includes(user.role)) throw enrollmentError('Only the Institute Admin or Transport Manager can manage route stops.', 403);
  const stops = normalizeStops(input);
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const route = await Record.findOne({ module: 'Routes', id: routeId, instituteName: user.instituteName }).session(session);
      if (!route) throw enrollmentError('Route not found.', 404);
      if (pickupMode !== undefined) effectivePickupMode({}, { data: { 'Pickup mode': pickupMode } });
      const children = await Child.find({ accountSource: 'institute', instituteName: user.instituteName, assignedRouteId: route.id, pickupMode: 'route_stops' }).session(session);
      const changes = children.filter(child => {
        const stop = stops.find(item => item.id === child.pickupStopId);
        if (!stop) throw enrollmentError(`A pickup point is assigned to students. Reassign those students before removing the stop.`, 409);
        return child.location?.lat !== stop.coordinates.lat || child.location?.lng !== stop.coordinates.lng || child.pickupStopName !== stop.name || child.pickupTime !== stop.expectedTime || child.pickupLocation !== `${stop.name} — ${stop.address}`;
      });
      const ids = changes.map(child => child._id);
      if (ids.length && await Trips.exists({ status: 'in_transit', $or: [{ child: { $in: ids } }, { students: { $in: ids } }] }).session(session)) throw enrollmentError('A ride is in progress. Update assigned pickup points after the ride ends.', 409);
      for (const child of changes) {
        const stop = stops.find(item => item.id === child.pickupStopId);
        child.location = stop.coordinates; child.pickupLocation = `${stop.name} — ${stop.address}`; child.pickupStopName = stop.name; child.pickupTime = stop.expectedTime;
        await child.save({ session });
        await Record.updateMany({ module: 'Students', instituteName: user.instituteName, 'coreLink.id': child._id }, { $set: { 'data.Pickup point': child.pickupLocation, 'data.Pickup point coordinates': stop.coordinates, 'data.Pickup stop': stop.name, 'data.Pickup time': stop.expectedTime } }, { session });
        const parent = await Parent.findOne({ _id: child.parentId, instituteId: child.instituteId }).session(session);
        const driver = await Driver.findOne({ driverId: child.driverId, instituteId: child.instituteId }).session(session);
        const message = `${child.name}'s pickup point is ${child.pickupLocation}, at ${stop.expectedTime}. Open the app for the updated map location.`;
        if (parent) await notice(parent, 'parent', 'Pickup point updated', message, session, child._id);
        if (driver) await notice(driver, 'driver', 'Pickup point updated', message, session, child._id);
      }
      route.stops = stops; route.data = { ...route.data, ...(pickupMode !== undefined ? { 'Pickup mode': pickupMode } : {}), 'Pickup stops': stops.map(stop => stop.name).join(', ') };
      route.assignmentRevision = (route.assignmentRevision || 0) + 1;
      await route.save({ session }); result = route;
    });
    return result;
  } finally { await session.endSession(); }
}
