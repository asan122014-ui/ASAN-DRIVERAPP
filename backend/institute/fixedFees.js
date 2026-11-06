import Driver from '../models/Driver.js';
import Parent from '../models/Parent.js';
import Child from '../models/Child.js';
import Invoice from '../models/Invoice.js';
import { enrollmentError } from './enrollmentPolicy.js';

export function fixedMonthlyAmount(value) {
  const text = String(value ?? '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw enrollmentError('Enter a monthly transport fee in rupees with at most two decimal places.');
  const amount = Number(text);
  if (!Number.isFinite(amount) || amount < 1 || amount > 1000000) throw enrollmentError('Monthly transport fee must be between ₹1 and ₹10,00,000.');
  return amount;
}
export function instituteBillingMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' }).formatToParts(now);
  return `${parts.find(part => part.type === 'year').value}-${parts.find(part => part.type === 'month').value}`;
}
export async function ensureStudentFeeInvoice(child, { session = null, now = new Date() } = {}) {
  if (child.accountSource !== 'institute' || !child.instituteId || !child.driverId || !child.assignedRouteName || child.monthlyTransportFee == null) return null;
  const amount = fixedMonthlyAmount(child.monthlyTransportFee);
  const month = instituteBillingMonth(now);
  const [year, monthNumber] = month.split('-').map(Number);
  const dueDate = new Date(Date.UTC(year, monthNumber, 0, 18, 29, 59));
  // The existing child/month unique index protects against duplicate monthly bills.
  // Issued invoices are snapshots: fee changes affect future bills only.
  try {
    const invoice = await Invoice.findOneAndUpdate({ childId: child._id, month }, { $setOnInsert: {
      billingSource: 'institute_fixed', instituteId: child.instituteId, instituteName: child.instituteName,
      routeName: child.assignedRouteName, parentId: child.parentId, childId: child._id, driverId: child.driverId,
      invoiceNumber: `ASAN-INS-${month.replace('-', '')}-${String(child._id).toUpperCase()}`,
      month, generatedAt: now, dueDate, ratePerKm: 0, baseAmount: amount, totalAmount: amount,
      platformCommission: 0, status: 'Pending', paymentStatus: 'Pending', remarks: `Fixed monthly Institute transport fee — ${child.assignedRouteName}`,
    } }, { upsert: true, returnDocument: 'after', session, runValidators: true });
    if (invoice.billingSource !== 'institute_fixed') throw enrollmentError('This student already has a different invoice for the current month. Ask ASAN Admin to review it.', 409);
    return invoice;
  } catch (error) {
    if (!session && error.code === 11000) return Invoice.findOne({ childId: child._id, month });
    throw error;
  }
}
export async function ensureInstituteFeeInvoices(filter, now = new Date()) {
  await Invoice.init();
  const children = await Child.find({ ...filter, accountSource: 'institute', monthlyTransportFee: { $gte: 1 }, driverId: { $ne: '' }, assignedRouteName: { $ne: '' } });
  const [parents, drivers] = await Promise.all([
    Parent.find({ _id: { $in: children.map(child => child.parentId) }, accountSource: 'institute', isActive: { $ne: false } }).select('_id instituteId').lean(),
    Driver.find({ driverId: { $in: children.map(child => child.driverId) }, accountSource: 'institute', status: 'approved' }).select('driverId instituteId').lean(),
  ]);
  const parentInstitutes = new Map(parents.map(parent => [String(parent._id), String(parent.instituteId)]));
  const driverInstitutes = new Map(drivers.map(driver => [driver.driverId, String(driver.instituteId)]));
  for (const child of children) if (parentInstitutes.get(String(child.parentId)) === String(child.instituteId) && driverInstitutes.get(child.driverId) === String(child.instituteId)) await ensureStudentFeeInvoice(child, { now });
}
