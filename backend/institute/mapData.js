import Driver from '../models/Driver.js';
import Child from '../models/Child.js';
import Institute from './models/Institute.js';
import Record from './models/Record.js';
export const validPoint = point => point && typeof point.lat === 'number' && typeof point.lng === 'number' && Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
export async function instituteMapData(name) {
  const institute = await Institute.findOne({ name }).select('_id name location').lean();
  if (!institute) return { vehicles: [], points: [] };
  const [drivers, children, routes] = await Promise.all([
    Driver.find({ instituteId: institute._id, accountSource: 'institute', status: 'approved' }).select('_id name driverId vehicleNumber lastLocation currentStatus studentsAssigned').lean(),
    Child.find({ instituteId: institute._id, accountSource: 'institute' }).select('_id name location dropLocationCoords pickupLocation dropoffLocation driverId').lean(),
    Record.find({ instituteName: name, module: 'Routes' }).select('id data stops').lean(),
  ]);
  const vehicles = drivers.filter(driver => validPoint(driver.lastLocation) && driver.lastLocation.updatedAt).map(driver => ({ id: String(driver._id), 'Vehicle number': driver.vehicleNumber, Driver: driver.name, 'ASAN ID': driver.driverId, Latitude: driver.lastLocation.lat, Longitude: driver.lastLocation.lng, 'Speed (km/h)': driver.lastLocation.speed, 'Trip status': driver.currentStatus === 'on_trip' ? 'On route' : 'Idle', updatedAt: driver.lastLocation.updatedAt, stale: Date.now() - new Date(driver.lastLocation.updatedAt).getTime() > 120000, 'Student count': driver.studentsAssigned }));
  const points = [];
  const add = (id, kind, label, position, address) => { if (validPoint(position)) points.push({ id, kind, label, position, address }); };
  add('campus', 'campus', institute.name, institute.location, institute.location?.address);
  for (const child of children) { add(`pickup-${child._id}`, 'pickup', `${child.name} — pickup`, child.location, child.pickupLocation); add(`drop-${child._id}`, 'drop', `${child.name} — drop-off`, child.dropLocationCoords, child.dropoffLocation); }
  for (const route of routes) {
    add(`${route.id}-start`, 'route', `${route.data?.['Route name']} — start`, route.data?.['Starting point coordinates'], route.data?.['Starting point']);
    add(`${route.id}-end`, 'route', `${route.data?.['Route name']} — destination`, route.data?.['Destination coordinates'], route.data?.Destination);
    (route.stops || []).forEach((stop, index) => add(`${route.id}-stop-${index}`, 'stop', stop.name || `Stop ${index + 1}`, stop.coordinates, stop.address));
  }
  return { vehicles, points };
}
