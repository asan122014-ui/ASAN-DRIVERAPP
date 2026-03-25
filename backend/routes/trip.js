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

/* ================= TRIP HISTORY ================= */
router.get("/history", getTripHistory);

/* ================= ACTIVE TRIP ================= */
router.get("/active", getActiveTrip);

export default router;
