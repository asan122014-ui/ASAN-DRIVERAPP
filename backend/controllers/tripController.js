import express from "express";
import verifyToken from "../middleware/auth.js";

import {
  startTrip,
  endTrip,
  getTripHistory,
  getActiveTrip
} from "../controllers/tripController.js";

const router = express.Router();

router.post("/start", verifyToken, startTrip);

router.post("/end", verifyToken, endTrip);

router.get("/history", verifyToken, getTripHistory);

router.get("/active", verifyToken, getActiveTrip);

export default router;