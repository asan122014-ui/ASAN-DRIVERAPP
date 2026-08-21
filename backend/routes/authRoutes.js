import express from "express";

import Driver from "../models/Driver.js";
import Parent from "../models/Parent.js";

import verifyParent from "../middleware/verifyParent.js";

const router =
  express.Router();

/* =========================================================
   HELPERS
========================================================= */

/* =========================================================
   NORMALIZE DRIVER ID
========================================================= */

const normalizeDriverId = (
  driverId
) => {
  return String(
    driverId || ""
  )
    .trim()
    .toUpperCase();
};

/* =========================================================
   SAVE PARENT FCM TOKEN
========================================================= */

/*
  Parent authentication uses ASAN Parent JWT.

  Firebase remains only for FCM Messaging.
*/

router.post(
  "/save-token",

  verifyParent,

  async (
    req,
    res
  ) => {
    try {
      const {
        parentId,
        fcmToken,
      } =
        req.body ||
        {};

      /* ===================================================
         OWNERSHIP
      =================================================== */

      if (
        parentId &&
        String(
          parentId
        ) !==
          String(
            req.parent._id
          )
      ) {
        return res
          .status(403)
          .json({
            success:
              false,

            message:
              "You cannot modify another Parent account",
          });
      }

      /* ===================================================
         TOKEN
      =================================================== */

      const normalizedToken =
        typeof fcmToken ===
        "string"
          ? fcmToken.trim()
          : "";

      if (
        !normalizedToken
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "FCM token is required",
          });
      }

      /* ===================================================
         SAVE
      =================================================== */

      await Parent.findByIdAndUpdate(
        req.parent._id,

        {
          $addToSet: {
            fcmTokens:
              normalizedToken,
          },
        },

        {
          runValidators:
            true,
        }
      );

      return res
        .status(200)
        .json({
          success:
            true,

          message:
            "FCM token saved successfully",
        });
    } catch (
      error
    ) {
      console.error(
        "SAVE PARENT FCM TOKEN ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Failed to save token",
        });
    }
  }
);

/* =========================================================
   GET DRIVER BY CUSTOM DRIVER ID
   AUTHENTICATED PARENT
========================================================= */

/*
  Used when Parent enters:

  ASAN-XXXXXX

  during Driver linking.
*/

router.get(
  "/by-id/:driverId",

  verifyParent,

  async (
    req,
    res
  ) => {
    try {
      const driverId =
        normalizeDriverId(
          req.params
            .driverId
        );

      if (
        !driverId
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Driver ID is required",
          });
      }

      /* ===================================================
         APPROVED DRIVER ONLY
      =================================================== */

      const driver =
        await Driver.findOne({
          driverId,

          status:
            "approved",
        })
          .select(
            [
              "driverId",
              "name",
              "vehicleNumber",
              "vehicleType",
              "vehicleModel",
              "profilePhoto",
              "avatar",
              "status",
            ].join(" ")
          )
          .lean();

      if (
        !driver
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Approved Driver not found",
          });
      }

      /* ===================================================
         RESPONSE
      =================================================== */

      return res
        .status(200)
        .json({
          success:
            true,

          data: {
            ...driver,

            profilePhoto:
              driver
                .profilePhoto ||
              driver.avatar ||
              "",
          },
        });
    } catch (
      error
    ) {
      console.error(
        "GET DRIVER BY ID ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Failed to fetch Driver",
        });
    }
  }
);

/* =========================================================
   DRIVER AUTH MIGRATED
========================================================= */

/*
  Driver authentication and registration are now handled by:

  /api/driver-auth

  DRIVER REGISTRATION

  POST /api/driver-auth/send-register-otp

  POST /api/driver-auth/verify-register-otp


  DRIVER LOGIN

  POST /api/driver-auth/send-login-otp

  POST /api/driver-auth/verify-login-otp


  SESSION

  GET /api/driver-auth/me

  POST /api/driver-auth/logout


  There is no Driver password authentication anymore.

  OLD ROUTES REMOVED:

  POST /api/auth/signup

  POST /api/auth/login
*/

/* =========================================================
   EXPORT
========================================================= */

export default router;
