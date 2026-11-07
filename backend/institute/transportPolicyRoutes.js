import express from 'express';
import Institute from './models/Institute.js';
import { pickupModes } from './pickupPolicy.js';
const router = express.Router();
router.get('/', async (req, res) => {
  try {
    const institute = await Institute.findOne({ name: req.user.instituteName }).select('pickupMode').lean();
    if (!institute) return res.status(404).json({ message: 'Institute not found.' });
    res.json({ pickupMode: institute.pickupMode || 'door_to_door' });
  } catch { res.status(503).json({ message: 'Unable to load pickup settings.' }); }
});
router.put('/', async (req, res) => {
  if (req.user.role !== 'Institute Admin') return res.status(403).json({ message: 'Only the Institute Admin can change the default pickup mode.' });
  if (!pickupModes.includes(req.body?.pickupMode)) return res.status(400).json({ message: 'Choose door-to-door or route pickup points.' });
  try {
    const institute = await Institute.findOneAndUpdate({ name: req.user.instituteName }, { $set: { pickupMode: req.body.pickupMode } }, { new: true, runValidators: true });
    if (!institute) return res.status(404).json({ message: 'Institute not found.' });
    res.json({ pickupMode: institute.pickupMode, message: 'Default saved for new assignments. Existing students keep their pickup until reassigned.' });
  } catch { res.status(503).json({ message: 'Unable to save pickup settings.' }); }
});
export default router;
