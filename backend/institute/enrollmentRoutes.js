import express from 'express';
import multer from 'multer';
import sharp from 'sharp';
import crypto from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';
import rateLimit from 'express-rate-limit';
import Asset from './models/EnrollmentAsset.js';
import { enrollBatch, enrollmentInstitute } from './enrollment.js';
import { documentFields, enrollmentError } from './enrollmentPolicy.js';

const router = express.Router();
const fail = (res, error) => {
  if (!error.status) console.error('Institute enrollment failed:', error.name);
  res.status(error.status || 500).json({ message: error.status ? error.message : 'Enrollment could not be completed. No partial import was saved.' });
};
router.use(rateLimit({ windowMs: 60000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false }));
router.get('/status', async (req, res) => {
  try { const institute = await enrollmentInstitute(req.user); res.json({ enabled: true, driverPrefix: institute.driverPrefix }); }
  catch (error) { fail(res, error); }
});
router.post('/preview', async (req, res) => {
  try { res.json({ rows: await enrollBatch(req.user, req.body?.rows, { preview: true }), message: 'Preview only. No accounts or notifications were saved.' }); }
  catch (error) { fail(res, error); }
});
router.post('/commit', async (req, res) => {
  try { res.status(201).json({ rows: await enrollBatch(req.user, req.body?.rows), message: 'Accounts and assignments saved. Users can sign in with email OTP.' }); }
  catch (error) { fail(res, error); }
});
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } }).single('image');
router.post('/documents', async (req, res, next) => {
  try { req.enrollmentInstitute = await enrollmentInstitute(req.user); next(); } catch (error) { fail(res, error); }
}, (req, res) => upload(req, res, async error => {
  if (error) return res.status(400).json({ message: 'Upload one image of at most 10 MB.' });
  let uploaded;
  try {
    if (!documentFields.includes(req.body?.field) || !req.file) throw enrollmentError('Choose a document type and image.');
    const image = await sharp(req.file.buffer, { limitInputPixels: 40000000 }).rotate().jpeg({ quality: 88 }).toBuffer();
    cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });
    uploaded = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ resource_type: 'image', type: 'authenticated', public_id: `asan/institutes/${req.enrollmentInstitute._id}/${crypto.randomUUID()}` }, (err, result) => err ? reject(err) : resolve(result));
      stream.end(image);
    });
    const asset = await Asset.create({ instituteId: req.enrollmentInstitute._id, uploadedBy: req.user.id, field: req.body.field, originalName: String(req.file.originalname).slice(0, 150), publicId: uploaded.public_id, format: uploaded.format });
    return res.status(201).json({ id: asset._id, field: asset.field, name: asset.originalName });
  } catch (err) {
    if (uploaded) await cloudinary.uploader.destroy(uploaded.public_id, { type: 'authenticated' }).catch(() => {});
    return fail(res, err.status ? err : enrollmentError('The image could not be uploaded. Check its format and try again.'));
  }
}));
router.get('/documents/:id', async (req, res) => {
  try {
    if (!['Institute Admin', 'Transport Manager'].includes(req.user.role)) throw enrollmentError('Document access is restricted.', 403);
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) throw enrollmentError('Document not found.', 404);
    const institute = await (await import('./models/Institute.js')).default.findOne({ name: req.user.instituteName }).select('_id').lean();
    const asset = await Asset.findOne({ _id: req.params.id, instituteId: institute?._id }).lean();
    if (!asset) throw enrollmentError('Document not found.', 404);
    cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });
    const url = cloudinary.utils.private_download_url(asset.publicId, asset.format, { type: 'authenticated', expires_at: Math.floor(Date.now() / 1000) + 60 });
    res.set('Cache-Control', 'no-store').json({ url });
  } catch (error) { fail(res, error); }
});
export default router;
