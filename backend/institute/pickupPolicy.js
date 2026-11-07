import { coordinates, enrollmentError } from './enrollmentPolicy.js';
export const pickupModes = ['door_to_door', 'route_stops'];
export function effectivePickupMode(institute, route) {
  const override = route?.data?.['Pickup mode'];
  if (override && override !== 'inherit' && !pickupModes.includes(override)) throw enrollmentError('Choose door-to-door, route pickup points, or the Institute default.');
  return override && override !== 'inherit' ? override : institute.pickupMode || 'door_to_door';
}
export function stopTime(value) {
  const text = String(value || '').trim();
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) return text;
  const match = /^(0?[1-9]|1[0-2]):([0-5]\d)\s*(AM|PM)$/i.exec(text);
  if (!match) throw enrollmentError('Stop pickup time must use HH:mm or hh:mm AM/PM.');
  return `${String(Number(match[1]) % 12 + (match[3].toUpperCase() === 'PM' ? 12 : 0)).padStart(2, '0')}:${match[2]}`;
}
export function normalizeStops(stops) {
  if (!Array.isArray(stops) || stops.length > 200) throw enrollmentError('Save at most 200 route stops.');
  const ids = new Set();
  return stops.map((stop, index) => {
    const id = String(stop.id || '').trim(), name = String(stop.name || '').trim(), address = String(stop.address || '').trim();
    if (!id || id.length > 100 || ids.has(id)) throw enrollmentError('Every stop needs a unique saved identifier.');
    if (!name || name.length > 120 || !address || address.length > 500) throw enrollmentError('Every stop needs a name, address and confirmed map pin.');
    ids.add(id);
    const point = coordinates(stop.coordinates, `Stop ${index + 1}`);
    return { id, name, address, coordinates: point, location: `${point.lat}, ${point.lng}`, expectedTime: stopTime(stop.expectedTime), order: index + 1 };
  });
}
export function selectedStop(route, id) {
  const stop = route?.stops?.find(item => item.id === id);
  if (!stop) throw enrollmentError('Select a pickup point saved on this route.');
  return { ...stop, coordinates: coordinates(stop.coordinates, 'Route pickup point'), expectedTime: stopTime(stop.expectedTime) };
}
