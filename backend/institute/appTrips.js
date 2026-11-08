import Institute from './models/Institute.js';
import Child from '../models/Child.js';
import Driver from '../models/Driver.js';
import Trips from '../models/Trips.js';

const iso = value => value ? new Date(value).toISOString() : '';
const ist = value => value ? new Date(new Date(value).getTime() + 330 * 60000).toISOString().slice(0,16) : '';
export function tripRows(trips, children = [], drivers = []) {
  const groups = new Map();
  for (const trip of trips) {
    const key = `${trip.driverId}:${trip.tripType}:${iso(trip.startTime || trip.createdAt)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(trip);
  }
  return [...groups.values()].map(group => {
    const first = group[0], child = children.find(item => String(item._id) === String(first.child));
    const driver = drivers.find(item => item.driverId === first.driverId);
    const active = group.some(trip => trip.status === 'in_transit');
    const cancelled = group.every(trip => trip.status === 'cancelled');
    const finished = group.every(trip => ['completed','cancelled'].includes(trip.status));
    const ended = finished ? group.filter(trip => trip.endTime).map(trip => new Date(trip.endTime).getTime()) : [];
    const end = ended.length ? new Date(Math.max(...ended)) : null;
    const start = first.startTime || first.createdAt;
    return {id:`captain-${first._id}`, source:'captain', readOnly:true, created:iso(start).slice(0,10), data:{
      'Trip ID':`CAP-${String(first._id).slice(-10).toUpperCase()}`,
      Route:first.instituteRouteName || child?.assignedRouteName || `${first.route?.from || 'Pickup'} → ${first.route?.to || 'Campus'}`,
      Vehicle:first.instituteVehicleNumber || child?.assignedVehicleNumber || driver?.vehicleNumber || '—',
      Driver:first.instituteDriverName || driver?.name || first.driverId,
      'Driver ASAN ID':first.driverId, 'Trip type':first.tripType,
      'Start time':ist(start), 'End time':ist(end),
      Students:[...new Set(group.map(trip => trip.childName || children.find(item => String(item._id) === String(trip.child))?.name || 'Student'))].join(', '),
      'Pickup status':`${group.filter(trip => trip.pickupStatus).length} / ${group.length} picked up`,
      'Drop status':`${group.filter(trip => trip.dropStatus).length} / ${group.length} dropped off`,
      'Trip distance':group.length === 1 && first.routeDistanceKm != null ? `${first.routeDistanceKm} km` : '—',
      'Trip duration':end ? `${Math.max(0,Math.round((end-new Date(start))/60000))} mins` : 'In progress',
      'Trip status':active?'On route':cancelled?'Cancelled':finished?'Completed':'Scheduled',
    }};
  }).sort((a,b)=>b.data['Start time'].localeCompare(a.data['Start time']));
}
export async function instituteTripRows(instituteName) {
  const institute = await Institute.findOne({name:instituteName}).select('_id').lean();
  if (!institute) return [];
  const [children,drivers] = await Promise.all([
    Child.find({instituteId:institute._id,accountSource:'institute'}).select('name assignedRouteName assignedVehicleNumber').lean(),
    Driver.find({instituteId:institute._id,accountSource:'institute'}).select('name driverId vehicleNumber').lean(),
  ]);
  const trips = await Trips.find({$or:[{instituteId:institute._id},{instituteId:null,child:{$in:children.map(child=>child._id)},driverId:{$in:drivers.map(driver=>driver.driverId)}}]})
    .select('_id child childName driverId tripType status pickupStatus dropStatus startTime endTime createdAt route routeDistanceKm instituteRouteName instituteDriverName instituteVehicleNumber').sort({startTime:-1}).lean();
  return tripRows(trips,children,drivers);
}
