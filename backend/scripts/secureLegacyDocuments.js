// Dry-run by default. Apply only after the server supports clda:// references.
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import { privateCloudinaryReference } from '../services/privateCloudinary.js';

const args = process.argv.slice(2);
const envAt = args.indexOf('--env');
dotenv.config({ ...(envAt >= 0 ? { path: args[envAt + 1] } : {}), quiet: true });
cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });
const apply = args.includes('--apply');
const readPath = (doc, path) => path.split('.').reduce((value, key) => value?.[key], doc);
function publicImage(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.hostname !== 'res.cloudinary.com') return null;
    const prefix = `/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/`;
    if (!url.pathname.startsWith(prefix)) return null;
    let resource = url.pathname.slice(prefix.length);
    const version = /(?:^|\/)v\d+\//.exec(resource);
    if (version) resource = resource.slice(version.index + version[0].length);
    const match = /^(.*)\.(jpg|jpeg|png|webp)$/i.exec(resource);
    if (!match) return null;
    const publicId = decodeURIComponent(match[1]);
    if (!/^(asan\/(drivers|student-verification)|drivers)\//.test(publicId)) return null;
    return { publicId, format: match[2].toLowerCase() };
  } catch { return null; }
}
const docFields = ['licenseFront', 'licenseBack', 'rcFront', 'rcBack', 'insurance', 'idFront', 'idBack'];
const targets = { drivers: docFields, rejecteddrivers: docFields, trips: ['morningDrop.imageUrl', 'afternoonPickup.imageUrl'] };
const summary = { mode: apply ? 'apply' : 'dry-run', assets: 0, references: 0, updatedRecords: 0, protectedAssets: 0, failures: 0, collections: {}, storedReferenceTypes: {} };
try {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) throw new Error('CLOUDINARY_NOT_CONFIGURED');
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;
  const protectedIds = new Set();
  for await (const row of db.collection('drivers').find({}, { projection: { profilePhoto: 1, avatar: 1 } })) {
    for (const field of ['profilePhoto', 'avatar']) { const image = publicImage(row[field]); if (image) protectedIds.add(image.publicId); }
  }
  const assets = new Map();
  for (const [collection, paths] of Object.entries(targets)) {
    const projection = Object.fromEntries(paths.map(path => [path, 1]));
    for await (const row of db.collection(collection).find({}, { projection })) {
      for (const path of paths) {
        const original = readPath(row, path), image = publicImage(original);
        if (original) {
          const category = typeof original !== 'string' ? 'non-string' : original.startsWith('r2://') ? 'private-r2' : original.startsWith('clda://') ? 'private-cloudinary' : original.includes('/image/upload/') ? (image ? 'public-cloudinary-candidate' : 'unmatched-public-cloudinary') : original.startsWith('/api/institute/') ? 'protected-institute-endpoint' : 'other';
          summary.storedReferenceTypes[category] = (summary.storedReferenceTypes[category] || 0) + 1;
        }
        if (!image) continue;
        const refs = assets.get(image.publicId) || [];
        refs.push({ collection, recordId: row._id, path, original, image });
        assets.set(image.publicId, refs);
        summary.references++; summary.collections[collection] = (summary.collections[collection] || 0) + 1;
      }
    }
  }
  summary.assets = assets.size;
  for (const [publicId, refs] of assets) {
    if (protectedIds.has(publicId)) { summary.protectedAssets++; continue; }
    if (!apply) continue;
    try {
      let image;
      try {
        image = await cloudinary.api.resource(publicId, { resource_type: 'image', type: 'upload' });
        if (!['jpg', 'jpeg', 'png', 'webp'].includes(image.format)) throw new Error('UNSUPPORTED_IMAGE');
        // Reversible delivery-type move; never deletes a file or overwrites another asset.
        image = await cloudinary.uploader.rename(publicId, publicId, { type: 'upload', to_type: 'authenticated', overwrite: false, invalidate: true, resource_type: 'image' });
      } catch (error) {
        if (error.http_code !== 404) throw error;
        // Resume a prior move if the database update was interrupted.
        image = await cloudinary.api.resource(publicId, { resource_type: 'image', type: 'authenticated' });
      }
      const reference = privateCloudinaryReference(publicId, image.format);
      for (const item of refs) {
        const set = { [item.path]: reference };
        if (item.collection === 'trips') set[item.path.replace(/imageUrl$/, 'publicId')] = reference;
        const result = await db.collection(item.collection).updateOne({ _id: item.recordId, [item.path]: item.original }, { $set: set });
        summary.updatedRecords += result.modifiedCount;
      }
    } catch { summary.failures++; }
  }
  console.log(JSON.stringify(summary));
  if (summary.failures || summary.protectedAssets) process.exitCode = 2;
} catch (error) {
  console.error(JSON.stringify({ error: 'PRIVATE_DOCUMENT_MIGRATION_UNAVAILABLE', code: error.code || error.http_code || (/^[A-Z_]+$/.test(error.message) ? error.message : null) }));
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
