import express from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import Trips from "../models/Trips.js";
import Parent from "../models/Parent.js";

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
import verifyAdmin from "../middleware/verifyAdmin.js";
import verifyFirebaseToken from "../middleware/verifyFirebaseToken.js";

const router = express.Router();

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
  String(driverId || "")
    .trim()
    .toUpperCase();

const isValidObjectId = (
  value
) =>
  mongoose.Types.ObjectId.isValid(
    String(value || "")
  );

/* =========================================================
   LOAD AUTHENTICATED PARENT
========================================================= */

const requireParentAccount =
  async (
    req,
    res,
    next
  ) => {
    try {
      const firebaseUid =
        req.firebaseUser?.uid;

      if (!firebaseUid) {
        return res.status(401).json({
          success: false,
          message:
            "Parent authentication required",
        });
      }

      const parent =
        await Parent.findOne({
          firebaseUid,
        }).select(
          "+firebaseUid"
        );

      if (!parent) {
        return res.status(404).json({
          success: false,
          message:
            "Parent account not found",
        });
      }

      if (
        parent.status ===
        "inactive"
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Parent account is inactive",
        });
      }

      req.parent = parent;

      return next();
    } catch (error) {
      console.error(
        "TRIP PARENT AUTH ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Parent authentication failed",
      });
    }
  };

/* =========================================================
   DRIVER PARAM OWNERSHIP
========================================================= */

const requireOwnDriverParam =
  (
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
      return res.status(403).json({
        success: false,
        message:
          "You cannot access another Driver's trips",
      });
    }

    return next();
  };

/* =========================================================
   FORCE AUTHENTICATED DRIVER INTO BODY
========================================================= */

const useAuthenticatedDriver =
  (
    req,
    res,
    next
  ) => {
    const authenticatedDriverId =
      normalizeDriverId(
        req.driver?.driverId
      );

    if (!authenticatedDriverId) {
      return res.status(401).json({
        success: false,
        message:
          "Driver authentication required",
      });
    }

    /*
      If the old frontend sends driverId,
      it must match the JWT.
    */

    if (
      req.body?.driverId &&
      normalizeDriverId(
        req.body.driverId
      ) !==
        authenticatedDriverId
    ) {
      return res.status(403).json({
        success: false,
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

const requireDriverTripOwnership =
  async (
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
        return res.status(400).json({
          success: false,
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
        return res.status(404).json({
          success: false,
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

      return res.status(500).json({
        success: false,
        message:
          "Trip authorization failed",
      });
    }
  };

/* =========================================================
   PARENT OWNS TRIP
========================================================= */

const requireParentTripOwnership =
  async (
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
        return res.status(400).json({
          success: false,
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
        return res.status(404).json({
          success: false,
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

      return res.status(500).json({
        success: false,
        message:
          "Trip authorization failed",
      });
    }
  };

/* =========================================================
   PARENT PARAM OWNERSHIP
========================================================= */

const requireOwnParentParam =
  (
    req,
    res,
    next
  ) => {
    if (
      String(
        req.params.parentId
      ) !==
      String(
        req.parent._id
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You cannot access another Parent's trip history",
      });
    }

    return next();
  };

/* =========================================================
   SINGLE TRIP:
   ADMIN / OWNER DRIVER / OWNER PARENT
========================================================= */

const authorizeTripRead =
  async (
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
        return res.status(400).json({
          success: false,
          message:
            "Invalid Trip ID",
        });
      }

      const authHeader =
        req.headers.authorization;

      if (
        !authHeader?.startsWith(
          "Bearer "
        )
      ) {
        return res.status(401).json({
          success: false,
          message:
            "Authentication required",
        });
      }

      const token =
        authHeader
          .slice(7)
          .trim();

      if (!token) {
        return res.status(401).json({
          success: false,
          message:
            "Authentication required",
        });
      }

      let hint = null;

      try {
        hint =
          jwt.decode(token);
      } catch {
        hint = null;
      }

      /* ================= ADMIN ================= */

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

      /* ================= DRIVER ================= */

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
                      req.driver.driverId
                    ),
                }).select("_id");

              if (!trip) {
                return res.status(404).json({
                  success: false,
                  message:
                    "Trip not found",
                });
              }

              return next();
            } catch (error) {
              return res.status(500).json({
                success: false,
                message:
                  "Trip authorization failed",
              });
            }
          }
        );
      }

      /* ================= PARENT ================= */

      return verifyFirebaseToken(
        req,
        res,

        () =>
          requireParentAccount(
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
                  }).select("_id");

                if (!trip) {
                  return res.status(404).json({
                    success: false,
                    message:
                      "Trip not found",
                  });
                }

                return next();
              } catch (error) {
                return res.status(500).json({
                  success: false,
                  message:
                    "Trip authorization failed",
                });
              }
            }
          )
      );
    } catch (error) {
      console.error(
        "TRIP READ AUTH ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
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

  verifyFirebaseToken,
  requireParentAccount,
  requireParentTripOwnership,

  verifyMorningDropPhoto
);

router.patch(
  "/verify/afternoon-pickup/:tripId",

  verifyFirebaseToken,
  requireParentAccount,
  requireParentTripOwnership,

  verifyAfternoonPickupPhoto
);

/* =========================================================
   PARENT TRIP HISTORY
========================================================= */

router.get(
  "/parent/:parentId",

  verifyFirebaseToken,
  requireParentAccount,
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
