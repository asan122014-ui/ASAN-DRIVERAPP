import { normalizeStops } from './pickupPolicy.js';

// The saved array is management's order. Only expose this driver's students.
export function buildStopPickupPlan(institute, route, children) {
  const assigned = children.filter(child => child.pickupMode === 'route_stops' &&
    (child.assignedRouteId ? child.assignedRouteId === route.id : child.assignedRouteName === route.data?.['Route name']));
  const stops = normalizeStops(route.stops || []).map(stop => ({
    id: stop.id, stopName: stop.name, address: stop.address, coordinates: stop.coordinates,
    pickupTime: stop.expectedTime,
    students: assigned.filter(child => child.pickupStopId === stop.id).map(child => ({ id: String(child._id), name: child.name })),
  })).filter(stop => stop.students.length);
  return { routeId: route.id, routeName: route.data?.['Route name'], revision: route.assignmentRevision || 0, pickupMode: 'route_stops',
    campus: institute.location, pickupStops: stops,
    dropStops: [...stops].reverse().map(stop => ({ ...stop,
      dropTime: [...new Set(assigned.filter(child => child.pickupStopId === stop.id).map(child => child.eveningPickup).filter(Boolean))].join(', '),
    })) };
}
