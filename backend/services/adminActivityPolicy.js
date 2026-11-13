// Only business fields are copied to email. Never serialize whole database records.
export const activityCollections = {
  drivers: 'Driver', parents: 'Parent', children: 'Child', students: 'Student',
  bookings: 'Booking', bookingpayments: 'Booking payment', driverrequests: 'Driver request',
  trips: 'Trip', invoices: 'Invoice', driverpayouts: 'Driver payout',
  childlocationchangerequests: 'Location change request', announcements: 'Announcement',
  adminlogs: 'Admin action', logs: 'Admin activity', rejecteddrivers: 'Rejected driver', securitydeposits: 'Security deposit',
  institutes: 'Institute', institute_records: 'Institute record',
  institute_users: 'Institute staff', institute_demo_enquiries: 'Institute enquiry',
  websiteenquiries: 'Website enquiry', billingsettings: 'Billing settings',
};
const fields = new Set([
  'name', 'email', 'phone', 'driverId', 'parentId', 'childId', 'childIds',
  'bookingId', 'instituteName', 'instituteId', 'module', 'id', 'status',
  'paymentStatus', 'amount', 'totalAmount', 'paidAt', 'provider', 'currency',
  'assignedDriverId', 'requestedDriverId', 'routeDriverId', 'routeId',
  'renewalDecision', 'serviceStartsAt', 'serviceEndsAt', 'startDate',
  'action', 'adminId', 'admin', 'parent', 'driver', 'title', 'vehicleNumber', 'vehicleType', 'isActive',
  'pickupStatus', 'dropStatus', 'paymentReceived', 'paymentMethod', 'paymentReceivedAt', 'matchingStatus',
  'rejectionReason', 'type', 'school', 'area', 'preferredTransport', 'schoolName', 'contactName',
]);
export const safeBusinessFields = value => Object.fromEntries(
  Object.entries(value || {}).filter(([key, item]) => fields.has(key) && item != null)
    .map(([key, item]) => [key, String(item).slice(0, 250)]),
);
export function activityFromChange(change) {
  const collection = change.ns?.coll;
  if (!activityCollections[collection]) return null;
  if (!['insert', 'update', 'replace', 'delete'].includes(change.operationType)) return null;
  // Website submission emails already contain the full enquiry and have their own queue.
  if (collection === 'websiteenquiries' && change.operationType === 'insert') return null;
  const description = change.updateDescription;
  const changed = description ? Object.keys(description.updatedFields || {}).concat(description.removedFields || []) : [];
  const relevant = changed.filter(key => fields.has(key.split('.')[0]) ||
    (collection === 'institute_records' && /^(data|stops|homePickupOrder|homeDropOrder|assignmentRevision)(\.|$)/.test(key)));
  // Token refreshes, GPS, read flags and email-worker metadata aren't business actions.
  if (change.operationType === 'update' && !relevant.length) return null;
  const doc = change.fullDocument || {};
  return {
    collection, entity: activityCollections[collection], operation: change.operationType,
    recordId: String(change.documentKey?._id || ''),
    details: { ...safeBusinessFields(doc), ...(collection === 'institute_records' ? safeBusinessFields(doc.data) : {}) },
    changedFields: relevant.map(key => key.split('.')[0]).filter((key, i, all) => all.indexOf(key) === i),
    occurredAt: change.wallTime || new Date(),
  };
}
export function indiaMonth(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' }).format(now).split('-').slice(0, 2).join('-');
}
export function monthBounds(month) {
  const [year, number] = month.split('-').map(Number);
  return { start: new Date(Date.UTC(year, number - 1, 1) - 19800000), end: new Date(Date.UTC(year, number, 1) - 19800000) };
}
export function nextMonth(month) {
  const { end } = monthBounds(month);
  return indiaMonth(new Date(end.getTime() + 1000));
}
// A small, dependency-free PDF writer. Text is escaped and long lines wrap across pages.
export function reportPdf(lines) {
  const ascii = text => String(text).replace(/₹/g, 'INR ').replace(/[^\x20-\x7e]/g, ' ');
  const wrapped = lines.flatMap(line => ascii(line).match(/.{1,92}(?:\s|$)|.{1,92}/g) || ['']);
  const pages = [];
  for (let i = 0; i < wrapped.length; i += 45) pages.push(wrapped.slice(i, i + 45));
  const objects = ['', '', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  const pageRefs = [];
  for (const [index, page] of pages.entries()) {
    const pageId = objects.length + 1, streamId = pageId + 1;
    pageRefs.push(`${pageId} 0 R`);
    const escape = s => s.replace(/([\\()])/g, '\\$1');
    const stream = `BT /F1 11 Tf 16 TL 48 790 Td ${page.map((line, i) => `${i ? 'T* ' : ''}(${escape(line.trim())}) Tj`).join('\n')} ET\nBT /F1 9 Tf 48 30 Td (ASAN Rides | Page ${index + 1} of ${pages.length}) Tj ET`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamId} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  }
  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[1] = `<< /Type /Pages /Count ${pages.length} /Kids [${pageRefs.join(' ')}] >>`;
  let output = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(output)); output += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(output);
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(output);
}
