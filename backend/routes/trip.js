import express from "express";

import {
  startTrip,
  endTrip,
  getActiveTrip,
  getTripHistory,
  getParentTripHistory,
  pickupStudent,
  dropStudent,
  getTripProgress,
  receivePayment,
  getTripDetails,
} from "../controllers/tripController.js";

const router = express.Router();

/* ==================================================
   DRIVER TRIP
================================================== */

// Start Trip
router.post("/start", startTrip);

// End Trip
router.post("/end", endTrip);

// Active Trip
router.get("/active/:driverId", getActiveTrip);

// Driver Trip History
router.get("/history/:driverId", getTripHistory);

// Driver Trip Details
router.get(
  "/details/:driverId/:tripType/:date",
  getTripDetails
);

// Trip Progress
router.get("/progress/:driverId", getTripProgress);

// Receive Payment
router.post("/payment", receivePayment);

/* ==================================================
   STUDENT ACTIONS
================================================== */

// Pickup Student
router.post("/pickup/:tripId", pickupStudent);

// Drop Student
router.post("/drop/:tripId", dropStudent);

/* ==================================================
   PARENT
================================================== */

// Parent Trip History
router.get("/parent/:parentId", getParentTripHistory);

export default router;
