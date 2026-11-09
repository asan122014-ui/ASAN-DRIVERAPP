import mongoose from 'mongoose';
import {assertInvoiceCanCancel} from './cancelUnpaidInvoice.js';
import Institute from './models/Institute.js';
import Record from './models/Record.js';
import Driver from '../models/Driver.js';
import Parent from '../models/Parent.js';
import Child from '../models/Child.js';
import Trips from '../models/Trips.js';
import Invoice from '../models/Invoice.js';
import Notification from '../models/Notification.js';
import PushDelivery from '../models/PushDelivery.js';
import Otp from '../models/Otp.js';
import { linkRecord } from './sharedRecords.js';
import { enrollmentError } from './enrollmentPolicy.js';

// Permanently remove an Institute-managed app identity, never an individual
// account or another Institute's member. All dependent changes commit together.
export async function deleteInstituteRecord(user, module, id, confirmed = false) {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const row = await Record.findOne({ id, module, instituteName: user.instituteName }).session(session);
      if (!row) throw enrollmentError('Record not found.', 404);
      const link = row.coreLink || await linkRecord(module, row.data, user.instituteName);
      const Model = { Driver, Parent, Child }[link?.model];
      if (Model && { Driver: 'Drivers', Parent: 'Parents', Child: 'Students' }[link.model] !== module) throw enrollmentError('The account link does not match this directory. ASAN Admin must review it.', 409);
      if (!Model) {
        if (module === 'Routes' && await Child.exists({ accountSource: 'institute', instituteName: user.instituteName, $or: [{ assignedRouteId: row.id }, { assignedRouteName: row.data?.['Route name'] }] }).session(session)) throw enrollmentError('Reassign this route’s students before deleting the route.', 409);
        if (link) throw enrollmentError('This legacy app record needs ASAN Admin review before it can be removed.', 409);
        await Record.deleteOne({ _id: row._id }, { session });
        result = { deletedAccount: false, removedStudents: 0 };
        return;
      }
      if (user.role !== 'Institute Admin') throw enrollmentError('Only the Institute Admin can permanently delete an app account.', 403);
      if (!confirmed) throw enrollmentError('Confirm permanent deletion of the linked app account and its Institute records.', 409);
      const institute = await Institute.findOne({ name: user.instituteName }).session(session);
      const scope = { accountSource: 'institute', instituteId: institute?._id };
      const account = await Model.findOne({ _id: link.id, ...scope }).session(session);
      if (!account) {
        if (await Model.exists({ _id: link.id }).session(session)) throw enrollmentError('This account is not managed by your Institute. ASAN Admin must review it.', 409);
        await Record.deleteOne({ _id: row._id }, { session });
        result = { deletedAccount: false, removedStudents: 0 };
        return;
      }
      if (!institute) throw enrollmentError('Institute not found.', 404);
      const students = link.model === 'Child' ? [account] : await Child.find({ ...scope, ...(link.model === 'Parent' ? { parentId: account._id } : { driverId: account.driverId }) }).session(session);
      const childIds = students.map(child => child._id);
      if (link.model !== 'Child' && await Child.exists({ ...(link.model === 'Parent' ? { parentId: account._id } : { driverId: account.driverId }), $or: [{ accountSource: { $ne: 'institute' } }, { instituteId: { $ne: institute._id } }] }).session(session)) throw enrollmentError('This account has assignments outside this Institute. ASAN Admin must review those links before deletion.', 409);
      const tripTargets = [{ child: { $in: childIds } }, { students: { $in: childIds } }];
      if (link.model === 'Parent') tripTargets.push({ parent: account._id });
      if (link.model === 'Driver') tripTargets.push({ driverId: account.driverId });
      if (await Trips.exists({ status: 'in_transit', $or: tripTargets }).session(session)) throw enrollmentError('A ride is in progress. Finish the ride before deleting this account.', 409);
      const bills = { instituteId: institute._id, billingSource: 'institute_fixed', childId: { $in: childIds }, status: { $nin: ['Paid', 'Cancelled'] }, paymentStatus: { $ne: 'Success' } };
      const pendingCheckouts = await Invoice.find({ ...bills, $or: [{ razorpayOrderId: { $nin: [null, ''], $exists: true } }, { razorpayOrderLockExpiresAt: { $gt: new Date() } }, { status: 'Processing' }] }).select('status razorpayOrderId razorpayOrderLockExpiresAt').session(session);
      for (const invoice of pendingCheckouts) await assertInvoiceCanCancel(invoice);
      await Invoice.updateMany(bills, { $set: { status: 'Cancelled' } }, { session });
      await Trips.updateMany({ status: 'waiting', $or: tripTargets }, { $set: { status: 'cancelled' } }, { session });
      const affectedParents = new Set(students.map(child => String(child.parentId)));
      const affectedDrivers = new Set(students.map(child => child.driverId).filter(Boolean));
      if (link.model === 'Driver') {
        await Record.updateMany({ module: 'Routes', instituteName: institute.name, $or: [{ routeDriverId: account.driverId }, { 'data.Assigned driver ID': account.driverId }] }, { $unset: { routeDriverId: 1 }, $set: { 'data.Assigned driver': '', 'data.Assigned driver ID': '' }, $inc: { assignmentRevision: 1 } }, { session });
        await Child.updateMany({ ...scope, driverId: account.driverId }, { $set: { driverId: '', pickupMode: 'unassigned', pickupStopId: '', pickupStopName: '', assignedRouteId: '', assignedRouteName: '', assignedVehicleNumber: '', monthlyTransportFee: null } }, { session });
        await Record.updateMany({ module: 'Students', instituteName: institute.name, 'coreLink.id': { $in: childIds } }, { $set: { 'data.Driver assigned': '', 'data.ASAN ID': '', 'data.Assigned route': '', 'data.Assigned vehicle': '', 'data.Monthly fee': null, 'data.Transport fee': '', 'data.Payment status': 'Not billed' } }, { session });
        const sameNameDriver = await Driver.exists({ ...scope, name: account.name, _id: { $ne: account._id } }).session(session);
        if (!sameNameDriver) await Record.updateMany({ module: 'Routes', instituteName: institute.name, 'data.Assigned driver': account.name }, { $set: { 'data.Assigned driver': '' } }, { session });
      } else {
        await Child.deleteMany({ ...scope, _id: { $in: childIds } }, { session });
        await Record.deleteMany({ module: 'Students', instituteName: institute.name, 'coreLink.id': { $in: childIds } }, { session });
      }
      if (link.model !== 'Child') {
        await Model.deleteOne({ _id: account._id, ...scope }, { session });
        const recipient = link.model === 'Parent' ? { parent: account._id } : { driver: account.driverId };
        const noticeFilter = { $or: [recipient, ...(link.model === 'Parent' ? [{ child: { $in: childIds } }] : [])] };
        const notices = await Notification.find(noticeFilter).select('_id').session(session).lean();
        await PushDelivery.deleteMany({ 'data.notificationId': { $in: notices.map(notice => String(notice._id)) } }, { session });
        await Notification.deleteMany(noticeFilter, { session });
        const recipientType = link.model === 'Parent' ? 'parent' : 'driver';
        const tokens = (account.fcmTokens || []).filter(Boolean);
        if (tokens.length) {
          const jobs = await PushDelivery.find({ recipientType, tokens: { $in: tokens } }).select('_id').session(session).lean();
          await PushDelivery.updateMany({ _id: { $in: jobs.map(job => job._id) } }, { $pull: { tokens: { $in: tokens } } }, { session });
          await PushDelivery.deleteMany({ _id: { $in: jobs.map(job => job._id) }, tokens: { $size: 0 } }, { session });
        }
        await Otp.deleteMany({ email: account.email, purpose: link.model === 'Parent' ? 'login' : 'driver_login' }, { session });
        // Remove only this Institute's directory cards for the deleted identity.
        await Record.deleteMany({ instituteName: institute.name, module, $or: [{ 'coreLink.id': account._id }, { 'data.Email': account.email }] }, { session });
      }
      if (link.model === 'Child') {
        const notices = await Notification.find({ child: { $in: childIds } }).select('_id').session(session).lean();
        await PushDelivery.deleteMany({ 'data.notificationId': { $in: notices.map(notice => String(notice._id)) } }, { session });
        await Notification.deleteMany({ child: { $in: childIds } }, { session });
      }
      for (const parentId of affectedParents) {
        if (link.model === 'Parent' && parentId === String(account._id)) continue;
        const children = await Child.find({ ...scope, parentId }).select('driverId name').session(session);
        const driverIds = [...new Set(children.map(child => child.driverId).filter(Boolean))];
        await Parent.updateOne({ ...scope, _id: parentId }, { $set: { driverIds, driverId: driverIds[0] || null } }, { session });
        await Record.updateMany({ module: 'Parents', instituteName: institute.name, 'coreLink.id': new mongoose.Types.ObjectId(parentId) }, { $set: { 'data.Student': children.map(child => child.name).join(', ') } }, { session });
      }
      for (const driverId of affectedDrivers) {
        const count = await Child.countDocuments({ ...scope, driverId }).session(session);
        await Driver.updateOne({ ...scope, driverId }, { $set: { studentsAssigned: count } }, { session });
      }
      await Record.deleteOne({ _id: row._id }, { session });
      result = { deletedAccount: true, removedStudents: link.model === 'Driver' ? 0 : childIds.length };
    });
    return result;
  } finally { await session.endSession(); }
}
