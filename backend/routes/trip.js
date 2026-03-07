import express from "express";
import verifyToken from "../middleware/auth.js";

import {
  startTrip,
  endTrip,
  getTripHistory,
  getActiveTrip
} from "../controllers/tripController.js";

const router = express.Router();

/* ================= START TRIP ================= */

router.post("/start", verifyToken, startTrip);

/* ================= END TRIP ================= */

router.post("/end", verifyToken, endTrip);

/* ================= TRIP HISTORY ================= */

router.get("/history", verifyToken, getTripHistory);

/* ================= ACTIVE TRIP ================= */

router.get("/active", verifyToken, getActiveTrip);

export default router;
