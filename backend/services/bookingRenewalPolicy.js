import { serviceHasEnded, isPaidService } from './bookingServiceLifecycle.js';
import { quoteForDistance } from './bookingPricing.js';

export function renewalError(message, status = 409) {
  return Object.assign(new Error(message), { status });
}
export function renewalDetails(booking, now = new Date()) {
  if (!booking || !['active', 'expired'].includes(booking.status) || !isPaidService(booking) || !serviceHasEnded(booking, now)) {
    throw renewalError('You can continue this ride after its paid service period ends.');
  }
  if (!booking.assignedDriverId) throw renewalError('The previous driver is unavailable. Please book a new ride.');
  const children = (booking.children?.length ? booking.children : [booking.child]).map(child => ({
    name: child?.name, age: child?.age, gender: child?.gender || '', school: child?.school,
    grade: child?.grade || '', section: child?.section || '',
  }));
  if (!children.length || children.some(child => !child.name || !child.school || !Number.isInteger(child.age) || child.age < 1 || child.age > 17)) {
    throw renewalError('Your saved child details need updating. Please book a new ride.');
  }
  const route = booking.route?.toObject ? booking.route.toObject() : { ...booking.route };
  const validPoint = point => point && Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
  if (!route.pickup || !route.dropoff || !route.pickupTime || !route.schoolPickupTime || !validPoint(route.pickupCoordinates) || !validPoint(route.dropoffCoordinates)) {
    throw renewalError('Your saved route needs updating. Please book a new ride.');
  }
  // Reprice the saved, approved route; never copy a waived or stale payment amount.
  const quote = { ...quoteForDistance(route.distanceKm, booking.quote?.vehicleType || 'AUTO', children.length, booking.quote?.workingDays || 26), expiresAt: new Date(now.getTime() + 15 * 60 * 1000) };
  return { children, child: children[0], route, quote };
}
