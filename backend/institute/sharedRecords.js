import Invoice from '../models/Invoice.js';
import { instituteBillingMonth } from './fixedFees.js';
import Driver from '../models/Driver.js';
import Parent from '../models/Parent.js';
import Child from '../models/Child.js';
import Student from '../models/Students.js';
import Record from './models/Record.js';

export const normalizePhone = value => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
};
const text = value => String(value || '').trim().toLowerCase();
const phoneOptions = value => {
  const phone = normalizePhone(value);
  return /^\d{10}$/.test(phone) ? [phone, `91${phone}`, `+91${phone}`] : [];
};

// Match exact contact identities, never a name alone. This does not create an
// app account, approve a driver, assign a ride, or modify an existing profile.
export async function linkRecord(module, data, instituteName) {
  if (module === 'Drivers' || module === 'Parents') {
    const email = text(data.Email);
    const phones = phoneOptions(data[module === 'Drivers' ? 'Phone number' : 'Phone']);
    if (!email || !phones.length) return null;
    const Model = module === 'Drivers' ? Driver : Parent;
    const matches = await Model.find({ email, phone: { $in: phones } }).select('_id').limit(2).lean();
    return matches.length === 1 ? { model: module === 'Drivers' ? 'Driver' : 'Parent', id: matches[0]._id } : null;
  }
  if (module !== 'Students') return null;
  const name = text(data['Student name']);
  const phones = phoneOptions(data['Parent phone']);
  if (!name || !phones.length) return null;
  // The parent must already be explicitly linked by this institute.
  const parents = await Record.find({ module: 'Parents', instituteName }).select('coreLink data').lean();
  const ids = [];
  for (const row of parents) {
    const link = row.coreLink || await linkRecord('Parents', row.data, instituteName);
    if (link?.model === 'Parent') ids.push(link.id);
  }
  const parent = await Parent.findOne({ _id: { $in: ids }, phone: { $in: phones } }).select('_id').lean();
  if (!parent) return null;
  const children = await Child.find({ parentId: parent._id }).select('_id name school').lean();
  const candidates = children.filter(row => text(row.name) === name && text(row.school) === text(instituteName));
  if (candidates.length === 1) return { model: 'Child', id: candidates[0]._id };
  const students = await Student.find({ parentId: parent._id }).select('_id name schoolName').lean();
  const legacy = students.filter(row => text(row.name) === name && text(row.schoolName) === text(instituteName));
  return legacy.length === 1 ? { model: 'Student', id: legacy[0]._id } : null;
}

export async function refreshLinkedRecords(module, records, instituteName) {
  const models = { Drivers: [Driver, 'Driver', 'name phone email address driverId status'],
    Parents: [Parent, 'Parent', 'name phone email accountSource'],
    Students: [Child, 'Child', 'name grade school parentId status instituteReference monthlyTransportFee assignedRouteName assignedVehicleNumber accountSource'] };
  if (!models[module]) return records;
  // Also resolves links for migrated rows and accounts registered after a row
  // was entered. A read never creates or modifies a user's app account.
  for (const row of records) {
    row.coreLink ||= await linkRecord(module, row.data, instituteName);
    row.data['ASAN app link'] = row.coreLink ? 'Linked' : 'Not linked — matching app account required';
  }
  const [Model, kind, fields] = models[module];
  const ids = records.filter(row => row.coreLink?.model === kind).map(row => row.coreLink.id);
  const core = new Map((await Model.find({ _id: { $in: ids } }).select(fields).lean()).map(row => [String(row._id), row]));
  if (module === 'Students') {
    const legacyIds = records.filter(row => row.coreLink?.model === 'Student').map(row => row.coreLink.id);
    const legacy = await Student.find({ _id: { $in: legacyIds } }).select('name className schoolName status').lean();
    for (const student of legacy) core.set(String(student._id), { ...student, school: student.schoolName, grade: student.className });
  }
  const parentIds = module === 'Students' ? [...core.values()].map(item => item.parentId).filter(Boolean) : [];
  const parents = new Map((parentIds.length ? await Parent.find({ _id: { $in: parentIds } }).select('_id name phone email').lean() : []).map(parent => [String(parent._id), parent]));
  const managed = [...core.values()].filter(item => item.accountSource === 'institute');
  const invoiceFilter = module === 'Students' ? { childId: { $in: managed.map(item => item._id) } } : { parentId: { $in: managed.map(item => item._id) } };
  const bills = managed.length && ['Students', 'Parents'].includes(module) ? await Invoice.find({ ...invoiceFilter, billingSource: 'institute_fixed', month: instituteBillingMonth() }).select('childId parentId status paymentStatus').lean() : [];
  for (const row of records) {
    const match = core.get(String(row.coreLink?.id));
    if (!match) continue;
    if (module === 'Students' && text(match.school) !== text(instituteName)) continue;
    row.linkStatus = 'Linked to ASAN app';
    if (module === 'Drivers') Object.assign(row.data, { 'Driver name': match.name, Address: match.address, 'Phone number': match.phone, Email: match.email, 'ASAN ID': match.driverId, 'App approval status': match.status });
    if (module === 'Parents') {
      Object.assign(row.data, { 'Parent name': match.name, Phone: match.phone, Email: match.email });
      if (match.accountSource === 'institute') {
        const current = bills.filter(bill => String(bill.parentId) === String(match._id) && bill.status !== 'Cancelled');
        row.data['Payment status'] = !current.length ? 'Not billed' : current.every(bill => bill.status === 'Paid' && bill.paymentStatus === 'Success') ? 'Paid' : 'Pending';
      }
    }
    if (module === 'Students') {
      const parent = parents.get(String(match.parentId));
      if (match.accountSource === 'institute') {
        const bill = bills.find(item => String(item.childId) === String(match._id));
        Object.assign(row.data, { 'Monthly fee': match.monthlyTransportFee, 'Transport fee': match.monthlyTransportFee == null ? '' : `₹${match.monthlyTransportFee.toLocaleString('en-IN')} / month`, 'Assigned route': match.assignedRouteName || '', 'Assigned vehicle': match.assignedVehicleNumber || '', 'Payment status': bill?.status || 'Not billed' });
      }
      Object.assign(row.data, { 'Student name': match.name, Class: match.grade, 'Student ID': match.instituteReference || row.data['Student ID'] || row.data['Admission number'] || '', 'App ride status': match.status,
        ...(parent ? { 'Parent name': parent.name, 'Parent phone': parent.phone, 'Parent email': parent.email } : {}) });
    }
  }
  return records;
}
