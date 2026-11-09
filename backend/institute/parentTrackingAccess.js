import Child from '../models/Child.js';
import Invoice from '../models/Invoice.js';
import Trips from '../models/Trips.js';
import { instituteBillingMonth } from './fixedFees.js';

export function childTrackingAccess(child, invoices, trips) {
  const id = String(child._id);
  const paymentConfirmed = invoices.some(invoice => String(invoice.childId) === id && invoice.status === 'Paid' && invoice.paymentStatus === 'Success');
  const trip = trips.find(item => String(item.child) === id && item.driverId === child.driverId && item.status === 'in_transit' && item.startTime && !item.endTime);
  const assigned = Boolean(child.driverId && child.assignedRouteName);
  return { paymentConfirmed, tripStarted: Boolean(trip), canTrack: assigned && paymentConfirmed && Boolean(trip), reason: !assigned ? 'assignment_pending' : !paymentConfirmed ? 'payment_required' : !trip ? 'trip_not_started' : 'live', tripId: trip?._id || null };
}

export async function instituteParentTrackingAccess(parent, {children, driverId, childId, now = new Date()} = {}) {
  const students = children || await Child.find({parentId:parent._id, instituteId:parent.instituteId, accountSource:'institute', ...(driverId ? {driverId} : {}), ...(childId ? {_id:childId} : {})}).select('_id driverId assignedRouteName').lean();
  if (!students.length) return new Map();
  const ids = students.map(child => child._id);
  const [invoices, trips] = await Promise.all([
    Invoice.find({parentId:parent._id, instituteId:parent.instituteId, billingSource:'institute_fixed', month:instituteBillingMonth(now), childId:{$in:ids}, status:'Paid', paymentStatus:'Success'}).select('childId status paymentStatus').lean(),
    Trips.find({parent:parent._id, child:{$in:ids}, driverId:{$in:students.map(child=>child.driverId).filter(Boolean)}, status:'in_transit', startTime:{$ne:null}, endTime:null}).select('_id child driverId status startTime endTime').lean(),
  ]);
  return new Map(students.map(child=>[String(child._id),childTrackingAccess(child,invoices,trips)]));
}
