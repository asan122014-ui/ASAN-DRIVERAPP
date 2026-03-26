import express from "express";
import {
  startTrip,
  endTrip,
  getTripHistory,
  getActiveTrip
} from "../controllers/tripController.js";

const router = express.Router();

/* ================= START TRIP ================= */
router.post("/start", startTrip);   // ✅ FIXED (removed :driverId)

/* ================= END TRIP ================= */
router.post("/end", endTrip);       // ✅ FIXED (removed :driverId)

/* ================= ACTIVE TRIP ================= */
router.get("/active/:driverId", getActiveTrip);

/* ================= TRIP HISTORY ================= */
router.get("/history/:driverId", getTripHistory);

export default router;
