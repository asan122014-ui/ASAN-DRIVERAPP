import express from "express";
import {
  startTrip,
  endTrip,
  getTripHistory,
  getActiveTrip
} from "../controllers/tripController.js";

const router = express.Router();

/* ================= START TRIP ================= */
router.post("/start", startTrip);

/* ================= END TRIP ================= */
router.post("/end", endTrip);

/* ================= ACTIVE TRIP ================= */
router.get("/active", getActiveTrip);   // ✅ FIXED

/* ================= TRIP HISTORY ================= */
router.get("/history", getTripHistory); // ✅ FIXED

export default router;
