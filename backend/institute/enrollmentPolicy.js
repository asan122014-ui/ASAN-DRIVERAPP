export const documentFields = ['licenseFront', 'licenseBack', 'rcFront', 'rcBack', 'insurance', 'idFront', 'idBack'];
export const enrollmentError = (message, status = 400) => Object.assign(new Error(message), { status });
const text = value => String(value ?? '').trim();
export function coordinates(value, label) {
  if (!value || typeof value.lat !== 'number' || typeof value.lng !== 'number' || !Number.isFinite(value.lat) || !Number.isFinite(value.lng) || Math.abs(value.lat) > 90 || Math.abs(value.lng) > 180) throw enrollmentError(`${label}: confirm valid latitude and longitude on the map.`);
  return { lat: value.lat, lng: value.lng };
}
export function normalizeEnrollment(input) {
  const kind = input?.kind;
  if (!['driver', 'parent', 'child'].includes(kind)) throw enrollmentError('Choose driver, parent or child.');
  const row = { kind, name: text(input.name), reference: text(input.reference) };
  if (row.name.length < 2 || row.name.length > 100) throw enrollmentError('Name must contain 2–100 characters.');
  if (!/^[\p{L}\p{M}][\p{L}\p{M} '\u2019.-]*$/u.test(row.name)) throw enrollmentError('Names must use letters and spaces, without numbers.');
  if (kind === 'child') {
    if (row.reference.length > 100) throw enrollmentError('The saved student identifier is invalid.');
    row.parentEmail = email(input.parentEmail);
    row.driverEmail = input.driverEmail ? email(input.driverEmail) : '';
    if (input.monthlyFee !== undefined) row.monthlyFee = input.monthlyFee;
    row.grade = text(input.grade);
    row.assignedRoute = text(input.assignedRoute).slice(0, 120);
    row.pickupStopId = text(input.pickupStopId).slice(0, 100);
    row.assignedVehicle = text(input.assignedVehicle).slice(0, 30);
    row.pickupTime = text(input.pickupTime);
    row.dropoffTime = text(input.dropoffTime);
    for (const time of [row.pickupTime, row.dropoffTime]) if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw enrollmentError('Pickup and school return times must use HH:mm (24-hour time).');
    return row;
  }
  row.email = email(input.email);
  row.phone = text(input.phone).replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
  if (!/^[6-9]\d{9}$/.test(row.phone)) throw enrollmentError('Enter a valid 10-digit Indian mobile number.');
  row.address = text(input.address);
  if (!row.address || row.address.length > 500) throw enrollmentError('Address is required and must be at most 500 characters.');
  if (kind === 'parent') row.home = coordinates(input.home, 'Parent home location');
  if (kind === 'driver') {
    row.vehicleNumber = text(input.vehicleNumber).toUpperCase().replace(/\s/g, '');
    row.vehicleType = text(input.vehicleType);
    row.licenseNumber = text(input.licenseNumber).toUpperCase();
    if (!/^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{4}$/.test(row.vehicleNumber)) throw enrollmentError('Enter a valid Indian vehicle registration number.');
    if (!/^[A-Z]{2}[ -]?\d{2}[ -]?\d{4}[ -]?\d{7}$/.test(row.licenseNumber)) throw enrollmentError('Enter a valid driving licence number, for example TS0920200012345.');
    if (!['Auto', 'Car', 'Van', 'Bus', 'auto', 'car', 'van', 'bus'].includes(row.vehicleType)) throw enrollmentError('Choose Auto, Car, Van or Bus.');
    row.documents = {};
    for (const field of documentFields) {
      const id = text(input.documents?.[field]);
      if (!/^[a-f\d]{24}$/i.test(id)) throw enrollmentError(`Upload ${field} before enrolling this driver.`);
      row.documents[field] = id;
    }
  }
  return row;
}
function email(value) {
  const result = text(value).toLowerCase();
  if (result.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) throw enrollmentError('Enter a valid email address.');
  return result;
}
export function normalizeBatch(rows) {
  if (!Array.isArray(rows) || !rows.length || rows.length > 100) throw enrollmentError('Import between 1 and 100 rows at a time.');
  const identities = new Set();
  return rows.map((input, index) => {
    try {
      const row = normalizeEnrollment(input);
      const identity = row.email || row.reference || `${row.parentEmail}:${row.name.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ')}`;
      const key = `${row.kind}:${identity}`;
      if (identities.has(key)) throw enrollmentError('Duplicate account or student for the same parent in this file.');
      identities.add(key);
      return row;
    } catch (error) { throw enrollmentError(`Row ${index + 2}: ${error.message}`); }
  });
}
