import express from "express";
import {
  startTrip,
  endTrip,
  getActiveTrip,
  getTripHistory,
  getParentTripHistory, // 🔥 NEW
} from "../controllers/tripController.js";
import Parent from "../models/Parent.js";
const router = express.Router();

/* ================= DRIVER ROUTES ================= */

// START TRIP
router.post("/start", startTrip);

// END TRIP
router.post("/end", endTrip);

// ACTIVE TRIP (driver)
router.get("/active/:driverId", getActiveTrip);

// DRIVER TRIP HISTORY (OLD - keep if needed)
router.get("/history/:driverId", getTripHistory);


/* ================= 🔥 NEW: PARENT ROUTE ================= */

// ✅ VERY IMPORTANT (this is what you will use in frontend)
router.get("/parent/:parentId", getParentTripHistory);


export default router;
