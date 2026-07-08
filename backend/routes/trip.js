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

// Active Trips
router.get("/active/:driverId", getActiveTrips);

// Driver Trip History
router.get("/history/:driverId", getTripHistory);

// Driver Trip Details
router.get(
  "/details/:driverId/:tripType/:date",
  getTripDetails
);

// Trip Progress
router.get("/progress/:driverId", getTripProgress);

// Today's Trip Status
router.get("/today-status/:driverId", getTodayTripStatus);

// Receive Payment
router.post("/payment", receivePayment);

/* ==================================================
   STUDENT ACTIONS
================================================== */

// Pickup Student
router.post(
  "/pickup/:tripId",
  (req, res, next) => {
    console.log("✅ POST /pickup", req.params.tripId);
    next();
  },
  pickupStudent
);

// Drop Student
router.post(
  "/drop/:tripId",
  (req, res, next) => {
    console.log("✅ POST /drop", req.params.tripId);
    next();
  },
  dropStudent
);

// Upload Morning Drop Photo
router.post(
  "/morning-drop-photo/:tripId",
  (req, res, next) => {
    console.log("✅ POST /morning-drop-photo", req.params.tripId);
    next();
  },
  studentVerificationUpload.single("photo"),
  uploadMorningDropPhoto
);

// Upload Afternoon Pickup Photo
router.post(
  "/afternoon-pickup-photo/:tripId",
  (req, res, next) => {
    console.log("✅ POST /afternoon-pickup-photo", req.params.tripId);
    next();
  },
  studentVerificationUpload.single("photo"),
  uploadAfternoonPickupPhoto
);

/* ==================================================
   VERIFICATION
================================================== */

// Verify Morning Drop Photo
router.patch(
  "/verify/morning-drop/:tripId",
  verifyMorningDropPhoto
);

// Verify Afternoon Pickup Photo
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
   GET TRIP BY ID (KEEP LAST)
================================================== */

router.get("/:tripId", getTripById);

export default router;
