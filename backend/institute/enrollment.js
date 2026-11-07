import Invoice from '../models/Invoice.js';
import { fixedMonthlyAmount, ensureStudentFeeInvoice } from './fixedFees.js';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import Driver from '../models/Driver.js';
import Parent from '../models/Parent.js';
import Child from '../models/Child.js';
import Record from './models/Record.js';
import Institute from './models/Institute.js';
import Asset from './models/EnrollmentAsset.js';
import Notification from '../models/Notification.js';
import PushDelivery from '../models/PushDelivery.js';
import Trips from '../models/Trips.js';
import { normalizeBatch, enrollmentError, documentFields, coordinates } from './enrollmentPolicy.js';
import { initializeEnrollmentDriver } from './enrollmentIndexes.js';
import { effectivePickupMode, selectedStop } from './pickupPolicy.js';

const membership = institute => ({ accountSource: 'institute', instituteId: institute._id, instituteName: institute.name });
const isMember = (account, institute) => account.accountSource === 'institute' && String(account.instituteId) === String(institute._id);
export function parentPickup(parent) {
  const point = parent.homeLocation?.coordinates;
  return { address: parent.address, point: coordinates(point?.length === 2 ? { lat: point[1], lng: point[0] } : null, 'Parent home location') };
}
export async function syncInstituteParentPickup(parent, institute, session) {
  const pickup = parentPickup(parent);
  const children = await Child.find({ parentId: parent._id, instituteId: institute._id, accountSource: 'institute', pickupMode: { $nin: ['route_stops', 'unassigned'] } }).session(session);
  const changed = children.filter(child => child.pickupLocation !== pickup.address || child.location?.lat !== pickup.point.lat || child.location?.lng !== pickup.point.lng);
  if (!changed.length) return 0;
  const ids = changed.map(child => child._id);
  if (await Trips.exists({ status: 'in_transit', $or: [{ child: { $in: ids } }, { students: { $in: ids } }] }).session(session)) throw enrollmentError('A student has a ride in progress. Update the parent home location after the ride ends.', 409);
  await Child.updateMany({ _id: { $in: ids }, instituteId: institute._id, accountSource: 'institute' }, { $set: { pickupLocation: pickup.address, location: pickup.point } }, { session });
  await Record.updateMany({ module: 'Students', instituteName: institute.name, 'coreLink.id': { $in: ids } }, { $set: { 'data.Pickup point': pickup.address, 'data.Pickup point coordinates': pickup.point } }, { session });
  return changed.length;
}
export async function enrollmentInstitute(user, session) {
  if (user.role !== 'Institute Admin') throw enrollmentError('Only the Institute Admin can enroll app users.', 403);
  const institute = await Institute.findOne({ name: user.instituteName }).session(session || null);
  if (!institute?.managedEnrollmentEnabled || !institute?.driverPrefix) throw enrollmentError('ASAN Admin must enable Institute enrollment and assign an Institute driver prefix first.', 403);
  coordinates(institute.location?.toObject ? institute.location.toObject() : institute.location, 'Institute location');
  return institute;
}

export async function notice(account, kind, title, message, session, child) {
  const recipient = kind === 'driver' ? { driver: account.driverId } : { parent: account._id };
  const [notification] = await Notification.create([{ ...recipient, recipientType: kind, child, title, message, type: 'general', notificationKey: 'INSTITUTE_ASSIGNMENT', meta: { instituteId: String(account.instituteId) } }], { session });
  const tokens = [...new Set((account.fcmTokens || []).filter(Boolean))];
  if (tokens.length) await PushDelivery.create([{ recipientType: kind, tokens, notification: { title, body: message }, data: { type: 'general', notificationId: String(notification._id), notificationKey: 'INSTITUTE_ASSIGNMENT' } }], { session });
}

async function operational(module, account, data, institute, session) {
  // Reuse a single legacy contact row rather than leaving a duplicate card.
  let target = await Record.findOne({ module, instituteName: institute.name, 'coreLink.id': account._id }).session(session);
  if (!target && ['Drivers', 'Parents'].includes(module)) {
    const legacy = await Record.find({ module, instituteName: institute.name, coreLink: null, 'data.Email': account.email }).session(session);
    if (legacy.length === 1) target = legacy[0];
  }
  await Record.updateOne(target ? { _id: target._id } : { module, instituteName: institute.name, 'coreLink.id': account._id }, {
    $set: { data: { ...(target?.data || {}), ...data }, coreLink: { model: module === 'Drivers' ? 'Driver' : module === 'Parents' ? 'Parent' : 'Child', id: account._id } },
    $setOnInsert: { id: crypto.randomUUID(), created: new Date().toISOString().slice(0, 10), module, instituteName: institute.name },
  }, { upsert: true, session });
}

async function enroll(row, institute, user, session) {
  if (row.kind === 'child') {
    const parent = await Parent.findOne({ email: row.parentEmail, instituteId: institute._id, accountSource: 'institute' }).session(session);
    if (!parent || parent.isActive === false) throw enrollmentError(`Parent ${row.parentEmail} must have an active account in this institute first.`);
    const pickup = parentPickup(parent);
    row.pickupAddress = pickup.address;
    row.pickup = pickup.point;
    let driver = row.driverEmail ? await Driver.findOne({ email: row.driverEmail, instituteId: institute._id, accountSource: 'institute', status: 'approved' }).session(session) : null;
    if (row.driverEmail && !driver) throw enrollmentError(`Driver ${row.driverEmail} is not active in this institute.`);
    const normalizeName = value => String(value).normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
    let previous;
    if (row.reference) {
      previous = await Child.findOne({ instituteId: institute._id, instituteReference: row.reference }).session(session);
    } else {
      const siblings = await Child.find({ instituteId: institute._id, parentId: parent._id, accountSource: 'institute' }).session(session);
      const matches = siblings.filter(child => normalizeName(child.name) === normalizeName(row.name));
      if (matches.length > 1) throw enrollmentError('Multiple students with this name belong to this parent. Ask ASAN Admin to review the saved records.', 409);
      previous = matches[0];
      row.reference = previous?.instituteReference || `STU-${crypto.createHash('sha256').update(`${institute._id}:${parent._id}:${normalizeName(row.name)}`).digest('hex').slice(0, 20).toUpperCase()}`;
    }
    if (previous && String(previous.parentId) !== String(parent._id)) throw enrollmentError(`Student ${row.reference} belongs to a different parent. Contact ASAN Admin to transfer.`);
    if (previous?.assignedRouteName && !row.driverEmail && !row.assignedRoute && previous.driverId) driver = await Driver.findOne({ driverId: previous.driverId, instituteId: institute._id, status: 'approved' }).session(session);
    const routeName = row.assignedRoute || previous?.assignedRouteName;
    const route = routeName ? await Record.findOne({ module: 'Routes', instituteName: institute.name, 'data.Route name': routeName }).session(session) : null;
    if (routeName && !route) throw enrollmentError('The assigned route was not found in this Institute. Select a current route.');
    const mode = row.assignedRoute ? effectivePickupMode(institute, route) : previous?.pickupMode || effectivePickupMode(institute, route);
    let stop = null;
    if (route && driver && route.data?.['Assigned driver'] !== driver.name) throw enrollmentError('Use the driver assigned to the selected route.');
    if (mode === 'route_stops' && route) {
      stop = selectedStop(route, row.assignedRoute ? row.pickupStopId : previous?.pickupStopId);
      row.pickupAddress = `${stop.name} — ${stop.address}`; row.pickup = stop.coordinates; row.pickupTime = stop.expectedTime;
    } else if (mode === 'route_stops' || mode === 'unassigned') {
      if (driver) throw enrollmentError('For route pickup service, enroll the student without a driver first, then assign a route and pickup point from Students.');
      row.pickupAddress = 'Pickup point not assigned'; row.pickup = { lat: null, lng: null };
    }
    if (route) await Record.updateOne({ _id: route._id }, { $inc: { assignmentRevision: 1 } }, { session });
    const oldDriverId = previous?.driverId;
    if (previous && await Trips.exists({ status: 'in_transit', $or: [{ child: previous._id }, { students: previous._id }] }).session(session)) throw enrollmentError(`${row.name} has a ride in progress. Update the assignment after the ride ends.`, 409);
    const child = previous || new Child();
    const changed = !previous || previous.driverId !== (driver?.driverId || '') || previous.pickupStopId !== (stop?.id || '') || previous.pickupMode !== mode || (row.monthlyFee !== undefined && Number(row.monthlyFee) !== previous.monthlyTransportFee) || (row.assignedRoute && row.assignedRoute !== previous.assignedRouteName);
    Object.assign(child, membership(institute), { instituteReference: row.reference, parentId: parent._id, name: row.name, school: institute.name, grade: row.grade,
      pickupLocation: row.pickupAddress, location: row.pickup, dropoffLocation: institute.location.address,
      dropLocationCoords: { lat: institute.location.lat, lng: institute.location.lng }, pickupTime: row.pickupTime, eveningPickup: row.dropoffTime, driverId: driver?.driverId || '' });
    if (row.assignedRoute) child.assignedRouteName = row.assignedRoute;
    child.pickupMode = !route && mode !== 'door_to_door' ? 'unassigned' : mode;
    child.assignedRouteId = route?.id || '';
    child.pickupStopId = stop?.id || ''; child.pickupStopName = stop?.name || '';
    if (row.assignedVehicle) child.assignedVehicleNumber = row.assignedVehicle;
    if (row.monthlyFee !== undefined) {
      const route = await Record.findOne({ module: 'Routes', instituteName: institute.name, 'data.Route name': row.assignedRoute }).session(session);
      if (!route || !driver || route.data?.['Assigned driver'] !== driver.name) throw enrollmentError('Assign a route and its enrolled driver before setting the student fee.');
      child.monthlyTransportFee = fixedMonthlyAmount(row.monthlyFee);
    }
    await child.save({ session });
    const feeInvoice = await ensureStudentFeeInvoice(child, { session });
    for (const id of new Set([oldDriverId, driver?.driverId].filter(Boolean))) {
      const count = await Child.countDocuments({ driverId: id }).session(session);
      await Driver.updateOne({ driverId: id, instituteId: institute._id }, { $set: { studentsAssigned: count } }, { session });
    }
    const ids = await Child.distinct('driverId', { parentId: parent._id, instituteId: institute._id, driverId: { $ne: '' } }).session(session);
    parent.driverIds = ids; parent.driverId = ids[0] || null;
    await parent.save({ session });
    const siblings = await Child.find({ parentId: parent._id, instituteId: institute._id }).select('name').session(session).lean();
    await Record.updateOne({ module: 'Parents', instituteName: institute.name, 'coreLink.id': parent._id }, { $set: { 'data.Student': siblings.map(item => item.name).join(', ') } }, { session });
    await operational('Students', child, { 'Pickup mode': child.pickupMode, 'Pickup stop': child.pickupStopName, 'Pickup stop ID': child.pickupStopId, 'Student name': child.name, Class: child.grade, 'Admission number': row.reference, 'Student ID': row.reference, 'Parent name': parent.name, 'Parent phone': parent.phone, 'Parent email': parent.email, 'Pickup point': row.pickupAddress, 'Pickup point coordinates': row.pickup, 'Drop point': institute.location.address, 'Drop point coordinates': { lat: institute.location.lat, lng: institute.location.lng }, 'Driver assigned': driver?.name || '', 'ASAN ID': driver?.driverId || '', 'Pickup time': row.pickupTime, 'School return time': row.dropoffTime, 'Assigned route': child.assignedRouteName || '', 'Assigned vehicle': child.assignedVehicleNumber || '', 'Monthly fee': child.monthlyTransportFee, 'Transport fee': child.monthlyTransportFee == null ? '' : `₹${child.monthlyTransportFee.toLocaleString('en-IN')} / month`, 'Payment status': feeInvoice?.status || 'Not billed' }, institute, session);
    if (changed) {
      await notice(parent, 'parent', 'Institute transport updated', `${institute.name} ${driver ? `assigned ${driver.name} (${driver.driverId}) to` : 'registered'} ${child.name}. View your transport details${row.monthlyFee !== undefined ? ' and monthly invoice in Payments' : ''} in the app.`, session, child._id);
      if (driver) await notice(driver, 'driver', 'Institute student assigned', `${institute.name} assigned ${child.name} to your route. Open the app for pickup details.`, session, child._id);
      if (oldDriverId && oldDriverId !== driver?.driverId) {
        const old = await Driver.findOne({ driverId: oldDriverId, instituteId: institute._id }).session(session);
        if (old) await notice(old, 'driver', 'Institute assignment changed', `${child.name} is no longer assigned to you.`, session, child._id);
      }
    }
    return { kind: row.kind, name: child.name, id: child._id, driverId: driver?.driverId || '' };
  }
  const Model = row.kind === 'driver' ? Driver : Parent;
  const matches = await Model.find({ $or: [{ email: row.email }, { phone: { $in: [row.phone, `91${row.phone}`, `+91${row.phone}`] } }] }).session(session);
  if (matches.length > 1 || matches.some(item => item.email !== row.email || !isMember(item, institute))) throw enrollmentError(`${row.email}: an account already exists outside this Institute or the phone belongs to another account. ASAN Admin must review the link.`, 409);
  const existing = matches[0];
  const account = existing || new Model();
  Object.assign(account, membership(institute), { name: row.name, email: row.email, phone: row.phone, address: row.address });
  if (row.kind === 'parent') account.homeLocation = { type: 'Point', coordinates: [row.home.lng, row.home.lat] };
  else account.homeLocation = undefined;
  if (row.kind === 'driver') {
    const assets = await Asset.find({ _id: { $in: Object.values(row.documents) }, instituteId: institute._id }).session(session).lean();
    for (const field of documentFields) {
      const asset = assets.find(item => String(item._id) === row.documents[field] && item.field === field);
      if (!asset) throw enrollmentError(`${row.email}: ${field} is missing or belongs to another institute.`);
      // Store a protected server URL, never a publicly accessible identity-document URL.
      account[field] = `/api/institute/enrollment/documents/${asset._id}`;
    }
    Object.assign(account, { vehicleNumber: row.vehicleNumber, vehicleType: row.vehicleType.toLowerCase(), licenseNumber: row.licenseNumber });
    if (!existing) {
      const next = await Institute.findOneAndUpdate({ _id: institute._id }, { $inc: { driverSequence: 1 } }, { new: true, session });
      account.driverId = `${next.driverPrefix}-DRV-${String(next.driverSequence).padStart(4, '0')}`;
      account.status = 'approved'; account.approvedAt = new Date();
    }
    if (existing?.status !== 'approved' && existing) throw enrollmentError('This driver is suspended or under review. ASAN Admin must restore access.', 409);
  }
  await account.save({ session });
  if (row.kind === 'parent') await syncInstituteParentPickup(account, institute, session);
  await operational(row.kind === 'driver' ? 'Drivers' : 'Parents', account, row.kind === 'driver' ? { 'Driver name': row.name, Address: row.address, 'Phone number': row.phone, Email: row.email, 'ASAN ID': account.driverId, Status: 'Active', 'App approval status': account.status, 'Driving license': row.licenseNumber } : { 'Parent name': row.name, Phone: row.phone, Email: row.email, 'Pickup point': row.address, 'Pickup point coordinates': row.home }, institute, session);
  if (!existing) await notice(account, row.kind, 'Welcome to Institute transport', `${institute.name} has registered your transport account. Sign in with your registered email and verification code.`, session);
  return { kind: row.kind, name: row.name, id: account._id, driverId: account.driverId };
}

export async function enrollBatch(user, input, { preview = false } = {}) {
  const rows = normalizeBatch(input);
  // Explain missing Institute setup before attempting account/index preparation.
  await enrollmentInstitute(user);
  await Promise.all([initializeEnrollmentDriver(Driver), Parent.init(), Child.init(), Record.init(), Invoice.init(), Notification.init(), PushDelivery.init()]);
  const session = await mongoose.startSession();
  let result = [];
  try {
    await session.withTransaction(async () => {
      result = [];
      const institute = await enrollmentInstitute(user, session);
      // Parents and drivers must exist before dependent children are processed.
      for (const row of [...rows].sort((a, b) => Number(a.kind === 'child') - Number(b.kind === 'child'))) result.push(await enroll(row, institute, user, session));
      if (preview) throw Object.assign(new Error('Preview rollback'), { previewResult: result });
    });
  } catch (error) {
    if (error.previewResult) return error.previewResult;
    if (error.code === 11000) throw enrollmentError('A duplicate account or reference was found. Refresh and preview again.', 409);
    throw error;
  } finally { await session.endSession(); }
  return result;
}

export async function assignEnrolledStudent(user, input) {
  const record = await Record.findOne({ id: input.studentId, module: 'Students', instituteName: user.instituteName }).lean();
  if (record?.coreLink?.model !== 'Child') return false;
  const institute = await enrollmentInstitute(user);
  const child = await Child.findOne({ _id: record.coreLink.id, instituteId: institute._id, accountSource: 'institute' }).lean();
  if (!child) return false;
  const parent = await Parent.findById(child.parentId).select('email').lean();
  const route = await Record.findOne({ module: 'Routes', instituteName: institute.name, 'data.Route name': input.routeName }).lean();
  if (!route) throw enrollmentError('Choose a route from this Institute.');
  const driverName = route.data?.['Assigned driver'];
  const driverRecords = await Record.find({ module: 'Drivers', instituteName: institute.name, 'data.Driver name': driverName }).lean();
  if (driverRecords.length !== 1 || driverRecords[0].coreLink?.model !== 'Driver') throw enrollmentError('The route needs one enrolled Institute driver.');
  const driver = await Driver.findOne({ _id: driverRecords[0].coreLink.id, instituteId: institute._id, status: 'approved' }).select('email').lean();
  if (!driver) throw enrollmentError('The route driver is not active in this Institute.');
  await enrollBatch(user, [{ kind: 'child', reference: child.instituteReference, name: child.name, grade: child.grade, parentEmail: parent.email, driverEmail: driver.email,
    pickupStopId: input.pickupStopId || (child.assignedRouteId === route.id ? child.pickupStopId : ''), pickupTime: child.pickupTime, dropoffTime: child.eveningPickup, assignedRoute: input.routeName, assignedVehicle: route.data?.['Assigned vehicle'] || '', monthlyFee: fixedMonthlyAmount(input.monthlyFee) }]);
  return true;
}
