import express from 'express';
import verifyParent from '../middleware/verifyParent.js';
import verifyDriver from '../middleware/verifyDriver.js';
import Child from '../models/Child.js';
import Driver from '../models/Driver.js';
import Parent from '../models/Parent.js';
const router = express.Router();
async function dashboard(req, res, kind) {
  try {
    const account = kind === 'parent' ? req.parent : req.driver;
    if (account.accountSource !== 'institute' || !account.instituteId) return res.json({ managed: false });
    const filter = { instituteId: account.instituteId, accountSource: 'institute', ...(kind === 'parent' ? { parentId: account._id } : { driverId: account.driverId }) };
    const children = await Child.find(filter).select('name grade school driverId parentId location dropLocationCoords pickupLocation dropoffLocation pickupTime eveningPickup status instituteReference monthlyTransportFee assignedRouteName').sort({ name: 1 }).lean();
    const drivers = kind === 'parent' ? await Driver.find({ instituteId: account.instituteId, driverId: { $in: children.map(c => c.driverId).filter(Boolean) }, status: 'approved' }).select('name phone driverId vehicleNumber vehicleType lastLocation isOnline').lean() : [];
    const parents = kind === 'driver' ? await Parent.find({ instituteId: account.instituteId, _id: { $in: children.map(c => c.parentId) } }).select('_id name phone').lean() : [];
    res.json({ managed: true, instituteName: account.instituteName, driverId: account.driverId, children, drivers, parents });
  } catch { res.status(500).json({ message: 'Unable to load Institute transport. Please retry.' }); }
}
router.get('/parent', verifyParent, (req, res) => dashboard(req, res, 'parent'));
router.get('/driver', verifyDriver, (req, res) => dashboard(req, res, 'driver'));
export default router;
