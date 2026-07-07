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
  uploadMorningDropPhoto,
  uploadAfternoonPickupPhoto,
} from "../controllers/tripController.js";

import {
  studentVerificationUpload,
} from "../config/cloudinary.js";

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

// Upload morning drop verification photo
router.post(
  "/morning-drop-photo/:tripId",
  studentVerificationUpload.single("photo"),
  uploadMorningDropPhoto
);

// Upload afternoon pickup verification photo
router.post(
  "/afternoon-pickup-photo/:tripId",
  studentVerificationUpload.single("photo"),
  uploadAfternoonPickupPhoto
);

/* ==================================================
   PARENT
================================================== */

// Parent Trip History
router.get("/parent/:parentId", getParentTripHistory);

router.get("/today-status/:driverId", async (req, res) => {
  try {
    const { driverId } = req.params;

    // Today's range
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get only today's trips
    const trips = await Trips.find({
      driverId,
      createdAt: {
        $gte: today,
        $lt: tomorrow,
      },
    });

    // Separate trips
    const morningTrips = trips.filter(
      (trip) => trip.tripType === "morning"
    );

    const afternoonTrips = trips.filter(
      (trip) => trip.tripType === "afternoon"
    );

    // Check completion
    const morningCompleted =
      morningTrips.length > 0 &&
      morningTrips.every(
        (trip) => trip.status === "completed"
      );

    const afternoonCompleted =
      afternoonTrips.length > 0 &&
      afternoonTrips.every(
        (trip) => trip.status === "completed"
      );

    console.log({
      morningTrips: morningTrips.length,
      afternoonTrips: afternoonTrips.length,
      morningCompleted,
      afternoonCompleted,
    });

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
