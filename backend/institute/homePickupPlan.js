import mongoose from 'mongoose';
import Institute from './models/Institute.js';
import Record from './models/Record.js';
import Child from '../models/Child.js';
import Parent from '../models/Parent.js';
import Driver from '../models/Driver.js';
import Trips from '../models/Trips.js';
import { enrollmentError, coordinates } from './enrollmentPolicy.js';
import { effectivePickupMode, stopTime } from './pickupPolicy.js';
import { notice } from './enrollment.js';
const ordered = (ids, stops) => {
  const known = new Map(stops.map(stop => [stop.id, stop]));
  return [...new Set([...(ids || []), ...stops.map(stop => stop.id)])].filter(id => known.has(id)).map((id, index) => ({ ...known.get(id), order: index + 1 }));
};
export async function buildHomePickupPlan(institute, route, session = null, driverId = null) {
  const children = await Child.find({ instituteId: institute._id, accountSource: 'institute', pickupMode: 'door_to_door', ...(driverId ? {driverId} : {}), $or: [{ assignedRouteId: route.id }, { assignedRouteId: { $in: ['', null] }, assignedRouteName: route.data?.['Route name'] }] }).sort({ name: 1 }).session(session).lean();
  const parents = await Parent.find({ _id: { $in: children.map(child => child.parentId) }, instituteId: institute._id, accountSource: 'institute' }).session(session).lean();
  const stops = parents.map(parent => {
    const students = children.filter(child => String(child.parentId) === String(parent._id));
    const [lng, lat] = parent.homeLocation?.coordinates || [];
    return { id: `home-${parent._id}`, parentName: parent.name, parentPhone: parent.phone, address: parent.address, coordinates: coordinates({ lat, lng }, 'Parent home'), students: students.map(child => ({ id: String(child._id), name: child.name })), pickupTime: stopTime(route.homePickupTimes?.[String(parent._id)] || students[0]?.pickupTime), dropTime: stopTime(route.homeDropTimes?.[String(parent._id)] || students[0]?.eveningPickup) };
  });
  const pickupStops = ordered(route.homePickupOrder, stops);
  const dropStops = ordered(route.homeDropOrder?.length ? route.homeDropOrder : pickupStops.map(stop => stop.id).reverse(), stops);
  return { routeId: route.id, routeName: route.data?.['Route name'], revision: route.assignmentRevision || 0, campus: institute.location, pickupStops, dropStops };
}
function validateOrder(input, stops) {
  if (!Array.isArray(input) || input.length !== stops.length || new Set(input).size !== stops.length || input.some(id => !stops.some(stop => stop.id === id))) throw enrollmentError('The route assignments changed. Reload and include each home exactly once.');
  return input;
}
export async function saveHomePickupPlan(user, routeId, input) {
  if (!['Institute Admin', 'Transport Manager'].includes(user.role)) throw enrollmentError('Only transport management can arrange home pickups.', 403);
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const institute = await Institute.findOne({ name: user.instituteName }).session(session);
      const route = await Record.findOne({ id: routeId, module: 'Routes', instituteName: user.instituteName }).session(session);
      if (!institute || !route) throw enrollmentError('Route not found.', 404);
      if (effectivePickupMode(institute, { data: { 'Pickup mode': input.pickupMode ?? route.data?.['Pickup mode'] } }) !== 'door_to_door') throw enrollmentError('Home pickup ordering is available for door-to-door routes.');
      const plan = await buildHomePickupPlan(institute, route, session);
      const childIds = plan.pickupStops.flatMap(stop => stop.students.map(student => student.id));
      if (await Trips.exists({ status: 'in_transit', $or: [{ child: {$in:childIds} }, { students: {$in:childIds} }] }).session(session)) throw enrollmentError('Finish the current ride before changing its pickup sequence.', 409);
      route.homePickupOrder = validateOrder(input.pickupOrder, plan.pickupStops);
      route.homeDropOrder = validateOrder(input.dropOrder, plan.pickupStops);
      const pickupTimes = {}, dropTimes = {};
      for (const stop of plan.pickupStops) {
        const parentId = stop.id.slice(5);
        pickupTimes[parentId] = stopTime(input.times?.[stop.id]?.pickupTime || stop.pickupTime);
        dropTimes[parentId] = stopTime(input.times?.[stop.id]?.dropTime || stop.dropTime);
        const ids = stop.students.map(student => student.id);
        await Child.updateMany({ _id: {$in:ids}, instituteId: institute._id }, {$set:{pickupTime:pickupTimes[parentId], eveningPickup:dropTimes[parentId]}}, {session});
        await Record.updateMany({ module:'Students', instituteName:institute.name, 'coreLink.id':{$in:ids.map(id=>new mongoose.Types.ObjectId(id))} }, {$set:{'data.Pickup time':pickupTimes[parentId], 'data.School return time':dropTimes[parentId]}}, {session});
      }
      route.homePickupTimes = pickupTimes; route.homeDropTimes = dropTimes;
      if (input.pickupMode !== undefined) route.data = {...route.data, 'Pickup mode':input.pickupMode};
      const firstHome = plan.pickupStops.find(stop => stop.id === route.homePickupOrder[0]);
      route.data = {...route.data, 'Destination':institute.location.address || institute.name, 'Destination coordinates':{lat:institute.location.lat,lng:institute.location.lng}, 'Starting point':firstHome?.address || '', 'Starting point coordinates':firstHome?.coordinates || null};
      route.assignmentRevision = (route.assignmentRevision || 0) + 1;
      await route.save({session});
      const drivers = await Driver.find({ instituteId:institute._id, accountSource:'institute', driverId:{$in:await Child.distinct('driverId',{_id:{$in:childIds}}).session(session)} }).session(session);
      for (const driver of drivers) await notice(driver,'driver','Home pickup sequence updated',`${route.data['Route name']}: management updated your morning pickup and return drop-off order. Open Institute duty to review it.`,session);
      result = await buildHomePickupPlan(institute,route,session);
    });
    return result;
  } finally { await session.endSession(); }
}
