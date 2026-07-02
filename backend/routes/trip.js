import Trips from "../models/Trips.js";
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

router.get("/today-status/:driverId", async (req, res) => {
  try {
    const { driverId } = req.params;

   const today = new Date();
today.setHours(0, 0, 0, 0);

const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);

const trips = await Trips.find({
  driverId,
  createdAt: {
    $gte: today,
    $lt: tomorrow,
  },
});

console.log("Today's Trips:");
trips.forEach((trip) => {
  console.log({
    tripType: trip.tripType,
    status: trip.status,
    createdAt: trip.createdAt,
  });
});

    const morningCompleted = trips
  .filter((trip) => trip.tripType === "morning")
  .every((trip) => trip.status === "completed");

const afternoonCompleted = trips
  .filter((trip) => trip.tripType === "afternoon")
  .every((trip) => trip.status === "completed");

    res.json({
      success: true,
      morningCompleted,
      afternoonCompleted,
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: "Failed to fetch trip status",
    });
  }
});

export default router;
