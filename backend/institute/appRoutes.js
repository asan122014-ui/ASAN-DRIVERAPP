import {buildHomePickupPlan} from './homePickupPlan.js';
import {instituteParentTrackingAccess} from './parentTrackingAccess.js';
import {buildStopPickupPlan} from './appPickupPlan.js';
import {effectivePickupMode} from './pickupPolicy.js';
import Institute from './models/Institute.js';
import Record from './models/Record.js';
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
    const children = await Child.find(filter).select('name grade school driverId parentId location dropLocationCoords pickupLocation dropoffLocation pickupTime eveningPickup status instituteReference monthlyTransportFee assignedRouteName assignedRouteId pickupMode pickupStopId pickupStopName').sort({ name: 1 }).lean();
    const drivers = kind === 'parent' ? await Driver.find({ instituteId: account.instituteId, driverId: { $in: children.map(c => c.driverId).filter(Boolean) }, status: 'approved' }).select('name phone driverId vehicleNumber vehicleType lastLocation isOnline').lean() : [];
    const parents = kind === 'driver' ? await Parent.find({ instituteId: account.instituteId, _id: { $in: children.map(c => c.parentId) } }).select('_id name phone').lean() : [];
    let homeRoutes = [], stopRoutes = [];
    if (kind === 'driver') {
      const institute = await Institute.findById(account.instituteId);
      const routes = await Record.find({module:'Routes',instituteName:account.instituteName,'data.Route name':{$in:children.map(child=>child.assignedRouteName).filter(Boolean)}});
      if(institute) {
        homeRoutes = (await Promise.all(routes.filter(route => effectivePickupMode(institute, route) === 'door_to_door').map(route=>buildHomePickupPlan(institute,route,null,account.driverId)))).filter(plan=>plan.pickupStops.length);
        stopRoutes = routes.filter(route => effectivePickupMode(institute, route) === 'route_stops').map(route => buildStopPickupPlan(institute, route, children)).filter(plan => plan.pickupStops.length);
      }
    }
    const trackingAccess = kind === 'parent' ? await instituteParentTrackingAccess(account,{children}) : new Map();
    res.json({ managed: true, instituteName: account.instituteName, driverId: account.driverId, children: children.map(child => kind === 'parent' ? {...child, trackingAccess:trackingAccess.get(String(child._id))} : child), drivers, parents, homeRoutes, stopRoutes });
  } catch { res.status(500).json({ message: 'Unable to load Institute transport. Please retry.' }); }
}
router.get('/parent', verifyParent, (req, res) => dashboard(req, res, 'parent'));
router.get('/driver', verifyDriver, (req, res) => dashboard(req, res, 'driver'));
export default router;
