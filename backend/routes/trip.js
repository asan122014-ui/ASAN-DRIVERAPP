import express from "express";
import {
  startTrip,
  endTrip,
  getActiveTrip,
  getTripHistory
} from "../controllers/tripController.js";

const router = express.Router();

router.post("/start", startTrip);
router.post("/end", endTrip);
router.get("/active/:driverId", getActiveTrip);
router.get("/history/:driverId", getTripHistory); // ✅ THIS LINE IMPORTANT

export default router;
