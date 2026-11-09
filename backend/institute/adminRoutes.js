import express from 'express';
import verifyAdmin, { requireSuperAdmin } from '../middleware/verifyAdmin.js';
import Institute from './models/Institute.js';
import Driver from '../models/Driver.js';
import Parent from '../models/Parent.js';
import Child from '../models/Child.js';
import Asset from './models/EnrollmentAsset.js';
import { v2 as cloudinary } from 'cloudinary';
const router = express.Router();
router.use(verifyAdmin);
const models = { drivers: Driver, parents: Parent, children: Child };
router.get('/:id/drivers/:driverId/documents', async (req, res) => {
  try {
    if (![req.params.id, req.params.driverId].every(id => /^[a-f\d]{24}$/i.test(id))) return res.status(404).json({ message: 'Driver not found.' });
    const driver = await Driver.findOne({ _id: req.params.driverId, instituteId: req.params.id, accountSource: 'institute' }).select('name address vehicleNumber vehicleType licenseNumber licenseFront licenseBack rcFront rcBack insurance idFront idBack').lean();
    if (!driver) return res.status(404).json({ message: 'Driver not found.' });
    const fields = ['licenseFront', 'licenseBack', 'rcFront', 'rcBack', 'insurance', 'idFront', 'idBack'];
    const ids = fields.map(field => String(driver[field] || '').split('/').at(-1)).filter(id => /^[a-f\d]{24}$/i.test(id));
    const assets = await Asset.find({ _id: { $in: ids }, instituteId: req.params.id }).lean();
    cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true });
    const documents = assets.map(asset => ({ field: asset.field, url: cloudinary.utils.private_download_url(asset.publicId, asset.format, { type: 'authenticated', expires_at: Math.floor(Date.now() / 1000) + 60 }) }));
    res.set('Cache-Control', 'no-store').json({ driver: { name: driver.name, address: driver.address, vehicleNumber: driver.vehicleNumber, vehicleType: driver.vehicleType, licenseNumber: driver.licenseNumber }, documents });
  } catch { res.status(500).json({ message: 'Unable to load protected documents.' }); }
});
router.get('/', async (req, res) => {
  try {
    const institutes = await Institute.find().select('name driverPrefix managedEnrollmentEnabled createdAt').sort({ name: 1 }).lean();
    const counts = await Promise.all(Object.values(models).map(Model => Model.aggregate([{ $match: { accountSource: 'institute' } }, { $group: { _id: '$instituteId', count: { $sum: 1 } } }])));
    res.json({ data: institutes.map(item => ({ ...item, ...Object.fromEntries(Object.keys(models).map((kind, index) => [kind, counts[index].find(row => String(row._id) === String(item._id))?.count || 0])) })) });
  } catch { res.status(500).json({ message: 'Unable to load institutes.' }); }
});
router.patch('/:id/enrollment', requireSuperAdmin, async (req, res) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(404).json({ message: 'Institute not found.' });
    const prefix = String(req.body?.driverPrefix || '').trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9]{1,11}$/.test(prefix) || typeof req.body?.enabled !== 'boolean') return res.status(400).json({ message: 'Enter a unique Institute prefix of 2–12 letters/numbers and choose enrollment status.' });
    const institute = await Institute.findById(req.params.id);
    if (!institute) return res.status(404).json({ message: 'Institute not found.' });
    if (institute.driverSequence > 0 && institute.driverPrefix !== prefix) return res.status(409).json({ message: 'The prefix cannot change after driver IDs have been issued.' });
    institute.driverPrefix = prefix; institute.managedEnrollmentEnabled = req.body.enabled;
    await institute.save();
    res.json({ success: true });
  } catch (error) { res.status(error.code === 11000 ? 409 : 500).json({ message: error.code === 11000 ? 'That Institute prefix is already in use.' : 'Unable to update enrollment.' }); }
});
router.get('/:id/:kind', async (req, res) => {
  const Model = models[req.params.kind];
  if (!Model || !/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(404).json({ message: 'Not found.' });
  const page = Math.max(1, Math.min(10000, parseInt(req.query.page, 10) || 1));
  try {
    const filter = { instituteId: req.params.id, accountSource: 'institute' };
    const [data, total] = await Promise.all([Model.find(filter).select('name email phone driverId status instituteReference school grade parentId assignedRouteName monthlyTransportFee vehicleNumber vehicleType createdAt').sort({ name: 1, _id: 1 }).skip((page - 1) * 25).limit(25).lean(), Model.countDocuments(filter)]);
    res.json({ data, total, page, pages: Math.ceil(total / 25) });
  } catch { res.status(500).json({ message: 'Unable to load Institute members.' }); }
});
export default router;
