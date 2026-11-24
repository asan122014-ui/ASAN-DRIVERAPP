import mongoose from 'mongoose';

// A user-supplied reference in an avatar or Institute record is not permission
// to sign a private file. Match only authoritative, protected upload fields.
export async function mayReadPrivateMedia(req, reference) {
  if (req.admin?._id) return true;
  const db = mongoose.connection.db;
  if (!db) return false;
  const photoMatch = { $or: [{ 'morningDrop.imageUrl': reference }, { 'afternoonPickup.imageUrl': reference }] };
  if (req.driver?._id) {
    const documents = ['licenseFront','licenseBack','rcFront','rcBack','insurance','idFront','idBack'];
    if (await db.collection('drivers').findOne({ _id: req.driver._id, $or: documents.map(field => ({ [field]: reference })) }, { projection: { _id: 1 } })) return true;
    if (await db.collection('trips').findOne({ driverId: req.driver.driverId, ...photoMatch }, { projection: { _id: 1 } })) return true;
    return Boolean(await db.collection('driverpayouts').findOne({ driverId: req.driver.driverId, 'proof.publicId': reference }, { projection: { _id: 1 } }));
  }
  if (req.parent?._id) return Boolean(await db.collection('trips').findOne({ parent: req.parent._id, ...photoMatch }, { projection: { _id: 1 } }));
  if (req.user?.id && ['Institute Admin', 'Transport Manager'].includes(req.user.role)) {
    const institute = await db.collection('institutes').findOne({ name: req.user.instituteName }, { projection: { _id: 1 } });
    return Boolean(institute && await db.collection('instituteenrollmentassets').findOne({ instituteId: institute._id, publicId: reference }, { projection: { _id: 1 } }));
  }
  return false;
}
