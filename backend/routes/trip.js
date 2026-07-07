import express from "express";

import {
  startTrip,
  endTrip,
  getActiveTrips,
  getTripById,
  getTripHistory,
  getParentTripHistory,
  pickupStudent,
  dropStudent,
  getTripProgress,
  receivePayment,
  getTripDetails,
  uploadMorningDropPhoto,
  uploadAfternoonPickupPhoto,
  verifyMorningDropPhoto,
  verifyAfternoonPickupPhoto,
  getTodayTripStatus,
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

// Active Trips (Driver Dashboard)
router.get("/active/:driverId", getActiveTrips);

// Driver Trip History
router.get("/history/:driverId", getTripHistory);

// Driver Trip Details (by date)
router.get(
  "/details/:driverId/:tripType/:date",
  getTripDetails
);

// Trip Progress
router.get("/progress/:driverId", getTripProgress);

// Today's trip status
router.get("/today-status/:driverId", getTodayTripStatus);

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
   VERIFICATION
================================================== */

// Verify morning drop photo
router.patch(
  "/verify/morning-drop/:tripId",
  verifyMorningDropPhoto
);

// Verify afternoon pickup photo
router.patch(
  "/verify/afternoon-pickup/:tripId",
  verifyAfternoonPickupPhoto
);

/* ==================================================
   PARENT
================================================== */

// Parent Trip History
router.get("/parent/:parentId", getParentTripHistory);

/* ==================================================
   GET TRIP BY ID (MUST BE LAST)
================================================== */

// Get single trip by ID (parent/student view)
router.get("/:tripId", getTripById);

export default router;
