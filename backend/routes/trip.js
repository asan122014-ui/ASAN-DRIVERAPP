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

/* =========================================================
   DRIVER TRIP
========================================================= */

/*
  Start a new morning / afternoon trip
*/
router.post(
  "/start",
  startTrip
);

/*
  Complete the current trip
*/
router.post(
  "/end",
  endTrip
);

/*
  Get currently in-transit trips
  for a Driver
*/
router.get(
  "/active/:driverId",
  getActiveTrips
);

/*
  Driver trip history
*/
router.get(
  "/history/:driverId",
  getTripHistory
);

/*
  Get Driver trip details for
  a particular date and trip type
*/
router.get(
  "/details/:driverId/:tripType/:date",
  getTripDetails
);

/*
  Current trip progress
*/
router.get(
  "/progress/:driverId",
  getTripProgress
);

/*
  Morning / afternoon trip status
  for the current day
*/
router.get(
  "/today-status/:driverId",
  getTodayTripStatus
);

/*
  Record payment received
*/
router.post(
  "/payment",
  receivePayment
);

/* =========================================================
   STUDENT TRIP ACTIONS
========================================================= */

/*
  Pickup student
*/
router.post(
  "/pickup/:tripId",
  pickupStudent
);

/*
  Drop student
*/
router.post(
  "/drop/:tripId",
  dropStudent
);

/* =========================================================
   STUDENT VERIFICATION PHOTOS
========================================================= */

/*
  Morning:

  Upload photo after school drop.
*/
router.post(
  "/morning-drop-photo/:tripId",

  studentVerificationUpload.single(
    "photo"
  ),

  uploadMorningDropPhoto
);

/*
  Afternoon:

  Upload photo during school pickup.
*/
router.post(
  "/afternoon-pickup-photo/:tripId",

  studentVerificationUpload.single(
    "photo"
  ),

  uploadAfternoonPickupPhoto
);

/* =========================================================
   VERIFICATION REVIEW
========================================================= */

/*
  Verify morning drop photo
*/
router.patch(
  "/verify/morning-drop/:tripId",
  verifyMorningDropPhoto
);

/*
  Verify afternoon pickup photo
*/
router.patch(
  "/verify/afternoon-pickup/:tripId",
  verifyAfternoonPickupPhoto
);

/* =========================================================
   PARENT
========================================================= */

/*
  Parent trip history
*/
router.get(
  "/parent/:parentId",
  getParentTripHistory
);

/* =========================================================
   GET SINGLE TRIP
========================================================= */

/*
  IMPORTANT:

  Keep this route LAST.

  Otherwise values such as:

  /history/...
  /parent/...
  /active/...

  could potentially be interpreted as trip IDs.
*/

router.get(
  "/:tripId",
  getTripById
);

/* =========================================================
   EXPORT
========================================================= */

export default router;
