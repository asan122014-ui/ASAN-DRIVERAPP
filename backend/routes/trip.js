import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import Trips from "../models/Trips.js";

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

import verifyDriver from "../middleware/verifyDriver.js";
import verifyParent from "../middleware/verifyParent.js";
import verifyAdmin from "../middleware/verifyAdmin.js";

const router =
  express.Router();

const ADMIN_ROLES =
  new Set([
    "superadmin",
    "reviewer",
  ]);

/* =========================================================
   HELPERS
========================================================= */

const normalizeDriverId = (
  driverId
) =>
  String(
    driverId || ""
  )
    .trim()
    .toUpperCase();

const isValidObjectId = (
  value
) =>
  mongoose.Types.ObjectId.isValid(
    String(
      value || ""
    )
  );

/* =========================================================
   DRIVER PARAM OWNERSHIP
========================================================= */

const requireOwnDriverParam = (
  req,
  res,
  next
) => {
  const requestedDriverId =
    normalizeDriverId(
      req.params.driverId
    );

  const authenticatedDriverId =
    normalizeDriverId(
      req.driver?.driverId
    );

  if (
    !requestedDriverId ||
    requestedDriverId !==
      authenticatedDriverId
  ) {
    return res
      .status(403)
      .json({
        success:
          false,

        message:
          "You cannot access another Driver's trips",
      });
  }

  return next();
};

/* =========================================================
   FORCE AUTHENTICATED DRIVER INTO BODY
========================================================= */

const useAuthenticatedDriver = (
  req,
  res,
  next
) => {
  const authenticatedDriverId =
    normalizeDriverId(
      req.driver?.driverId
    );

  if (
    !authenticatedDriverId
  ) {
    return res
      .status(401)
      .json({
        success:
          false,

        message:
          "Driver authentication required",
      });
  }

  /*
    If old frontend still sends driverId,
    it must match authenticated Driver.
  */

  if (
    req.body?.driverId &&
    normalizeDriverId(
      req.body.driverId
    ) !==
      authenticatedDriverId
  ) {
    return res
      .status(403)
      .json({
        success:
          false,

        message:
          "You cannot perform this action for another Driver",
      });
  }

  req.body =
    req.body || {};

  req.body.driverId =
    authenticatedDriverId;

  return next();
};

/* =========================================================
   DRIVER OWNS TRIP
========================================================= */

const requireDriverTripOwnership = async (
  req,
  res,
  next
) => {
  try {
    const tripId =
      req.params.tripId ||
      req.body?.tripId;

    if (
      !isValidObjectId(
        tripId
      )
    ) {
      return res
        .status(400)
        .json({
          success:
            false,

          message:
            "Invalid Trip ID",
        });
    }

    const trip =
      await Trips.findOne({
        _id:
          tripId,

        driverId:
          normalizeDriverId(
            req.driver.driverId
          ),
      }).select(
        "_id driverId parent child status tripType"
      );

    if (!trip) {
      return res
        .status(404)
        .json({
          success:
            false,

          message:
            "Trip not found",
        });
    }

    req.authorizedTrip =
      trip;

    return next();
  } catch (error) {
    console.error(
      "DRIVER TRIP OWNERSHIP ERROR:",
      error
    );

    return res
      .status(500)
      .json({
        success:
          false,

        message:
          "Trip authorization failed",
      });
  }
};

/* =========================================================
   PARENT OWNS TRIP
========================================================= */

const requireParentTripOwnership = async (
  req,
  res,
  next
) => {
  try {
    const tripId =
      req.params.tripId;

    if (
      !isValidObjectId(
        tripId
      )
    ) {
      return res
        .status(400)
        .json({
          success:
            false,

          message:
            "Invalid Trip ID",
        });
    }

    const trip =
      await Trips.findOne({
        _id:
          tripId,

        parent:
          req.parent._id,
      }).select(
        "_id driverId parent child tripType status"
      );

    if (!trip) {
      return res
        .status(404)
        .json({
          success:
            false,

          message:
            "Trip not found",
        });
    }

    req.authorizedTrip =
      trip;

    return next();
  } catch (error) {
    console.error(
      "PARENT TRIP OWNERSHIP ERROR:",
      error
    );

    return res
      .status(500)
      .json({
        success:
          false,

        message:
          "Trip authorization failed",
      });
  }
};

/* =========================================================
   PARENT PARAM OWNERSHIP
========================================================= */

const requireOwnParentParam = (
  req,
  res,
  next
) => {
  const requestedParentId =
    String(
      req.params?.parentId ||
        ""
    );

  const authenticatedParentId =
    String(
      req.parent?._id ||
        ""
    );

  if (
    !requestedParentId ||
    !authenticatedParentId
  ) {
    return res
      .status(400)
      .json({
        success:
          false,

        message:
          "Parent ID is required",
      });
  }

  if (
    requestedParentId !==
    authenticatedParentId
  ) {
    return res
      .status(403)
      .json({
        success:
          false,

        message:
          "You cannot access another Parent's trip history",
      });
  }

  return next();
};

/* =========================================================
   SINGLE TRIP AUTHORIZATION

   ADMIN / DRIVER / PARENT
========================================================= */

const authorizeTripRead = async (
  req,
  res,
  next
) => {
  try {
    const tripId =
      req.params.tripId;

    if (
      !isValidObjectId(
        tripId
      )
    ) {
      return res
        .status(400)
        .json({
          success:
            false,

          message:
            "Invalid Trip ID",
        });
    }

    /* ===================================================
       AUTH HEADER
    =================================================== */

    const authHeader =
      req.headers.authorization;

    if (
      !authHeader?.startsWith(
        "Bearer "
      )
    ) {
      return res
        .status(401)
        .json({
          success:
            false,

          message:
            "Authentication required",
        });
    }

    const token =
      authHeader
        .slice(7)
        .trim();

    if (!token) {
      return res
        .status(401)
        .json({
          success:
            false,

          message:
            "Authentication required",
        });
    }

    /* ===================================================
       TOKEN HINT
    =================================================== */

    let hint =
      null;

    try {
      hint =
        jwt.decode(
          token
        );
    } catch {
      hint =
        null;
    }

    /* ===================================================
       ADMIN
    =================================================== */

    if (
      hint &&
      typeof hint ===
        "object" &&
      ADMIN_ROLES.has(
        hint.role
      )
    ) {
      return verifyAdmin(
        req,
        res,
        next
      );
    }

    /* ===================================================
       DRIVER
    =================================================== */

    if (
      hint &&
      typeof hint ===
        "object" &&
      hint.tokenType ===
        "driver"
    ) {
      return verifyDriver(
        req,
        res,

        async () => {
          try {
            const trip =
              await Trips.findOne({
                _id:
                  tripId,

                driverId:
                  normalizeDriverId(
                    req.driver
                      .driverId
                  ),
              }).select(
                "_id"
              );

            if (!trip) {
              return res
                .status(404)
                .json({
                  success:
                    false,

                  message:
                    "Trip not found",
                });
            }

            return next();
          } catch (error) {
            console.error(
              "DRIVER TRIP READ AUTH ERROR:",
              error
            );

            return res
              .status(500)
              .json({
                success:
                  false,

                message:
                  "Trip authorization failed",
              });
          }
        }
      );
    }

    /* ===================================================
       PARENT
    =================================================== */

    if (
      hint &&
      typeof hint ===
        "object" &&
      hint.tokenType ===
        "parent"
    ) {
      return verifyParent(
        req,
        res,

        async () => {
          try {
            const trip =
              await Trips.findOne({
                _id:
                  tripId,

                parent:
                  req.parent._id,
              }).select(
                "_id"
              );

            if (!trip) {
              return res
                .status(404)
                .json({
                  success:
                    false,

                  message:
                    "Trip not found",
                });
            }

            return next();
          } catch (error) {
            console.error(
              "PARENT TRIP READ AUTH ERROR:",
              error
            );

            return res
              .status(500)
              .json({
                success:
                  false,

                message:
                  "Trip authorization failed",
              });
          }
        }
      );
    }

    /* ===================================================
       UNKNOWN TOKEN
    =================================================== */

    return res
      .status(401)
      .json({
        success:
          false,

        message:
          "Unsupported authentication token",
      });
  } catch (error) {
    console.error(
      "TRIP READ AUTH ERROR:",
      error
    );

    return res
      .status(500)
      .json({
        success:
          false,

        message:
          "Trip authorization failed",
      });
  }
};

/* =========================================================
   DRIVER TRIP
========================================================= */

router.post(
  "/start",

  verifyDriver,

  useAuthenticatedDriver,

  startTrip
);

router.post(
  "/end",

  verifyDriver,

  useAuthenticatedDriver,

  endTrip
);

router.get(
  "/active/:driverId",

  verifyDriver,

  requireOwnDriverParam,

  getActiveTrips
);

router.get(
  "/history/:driverId",

  verifyDriver,

  requireOwnDriverParam,

  getTripHistory
);

router.get(
  "/details/:driverId/:tripType/:date",

  verifyDriver,

  requireOwnDriverParam,

  getTripDetails
);

router.get(
  "/progress/:driverId",

  verifyDriver,

  requireOwnDriverParam,

  getTripProgress
);

router.get(
  "/today-status/:driverId",

  verifyDriver,

  requireOwnDriverParam,

  getTodayTripStatus
);

/* =========================================================
   PAYMENT RECEIVED
   DRIVER ONLY
========================================================= */

router.post(
  "/payment",

  verifyDriver,

  requireDriverTripOwnership,

  receivePayment
);

/* =========================================================
   DRIVER STUDENT ACTIONS
========================================================= */

router.post(
  "/pickup/:tripId",

  verifyDriver,

  requireDriverTripOwnership,

  pickupStudent
);

router.post(
  "/drop/:tripId",

  verifyDriver,

  requireDriverTripOwnership,

  dropStudent
);

/* =========================================================
   DRIVER VERIFICATION PHOTO UPLOAD
========================================================= */

router.post(
  "/morning-drop-photo/:tripId",

  verifyDriver,

  requireDriverTripOwnership,

  studentVerificationUpload.single(
    "photo"
  ),

  uploadMorningDropPhoto
);

router.post(
  "/afternoon-pickup-photo/:tripId",

  verifyDriver,

  requireDriverTripOwnership,

  studentVerificationUpload.single(
    "photo"
  ),

  uploadAfternoonPickupPhoto
);

/* =========================================================
   PARENT PHOTO VERIFICATION
========================================================= */

router.patch(
  "/verify/morning-drop/:tripId",

  verifyParent,

  requireParentTripOwnership,

  verifyMorningDropPhoto
);

router.patch(
  "/verify/afternoon-pickup/:tripId",

  verifyParent,

  requireParentTripOwnership,

  verifyAfternoonPickupPhoto
);

/* =========================================================
   PARENT TRIP HISTORY
========================================================= */

router.get(
  "/parent/:parentId",

  verifyParent,

  requireOwnParentParam,

  getParentTripHistory
);

/* =========================================================
   SINGLE TRIP
========================================================= */

router.get(
  "/:tripId",

  authorizeTripRead,

  getTripById
);

export default router;
