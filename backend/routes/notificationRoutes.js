import express from "express";
import mongoose from "mongoose";

import Driver from "../models/Driver.js";
import Parent from "../models/Parent.js";

import {
  getNotifications,
  getAllNotifications,
  getParentNotifications,
  markAsRead,
  markAllAsRead,
  sendTestNotification,
} from "../controllers/notificationController.js";

const router = express.Router();

/* =========================================================
   HELPERS
========================================================= */

const normalizeDriverId = (driverId) => {
  if (!driverId) {
    return "";
  }

  return String(driverId)
    .trim()
    .toUpperCase();
};

/* =========================================================
   TEST NOTIFICATION
========================================================= */

/*
  Development/testing endpoint.

  We will decide whether to keep or remove this
  after inspecting notificationController.js.
*/

router.post(
  "/test",
  sendTestNotification
);

/* =========================================================
   SAVE FCM TOKEN
========================================================= */

/*
  POST /api/notifications/save-token

  Parent:

  {
    "parentId": "...",
    "token": "FCM_TOKEN"
  }

  Driver:

  {
    "driverId": "ASAN-XXXXXX",
    "token": "FCM_TOKEN"
  }

  driverId can also temporarily accept a MongoDB ObjectId
  for backwards compatibility.
*/

router.post(
  "/save-token",
  async (req, res) => {
    try {
      const {
        driverId,
        parentId,
        token,
      } = req.body;

      /* ===================================================
         TOKEN VALIDATION
      =================================================== */

      const normalizedToken =
        typeof token === "string"
          ? token.trim()
          : "";

      if (!normalizedToken) {
        return res.status(400).json({
          success: false,
          message: "Token is required",
        });
      }

      /* ===================================================
         RECIPIENT VALIDATION
      =================================================== */

      if (!driverId && !parentId) {
        return res.status(400).json({
          success: false,
          message:
            "Either driverId or parentId is required",
        });
      }

      if (driverId && parentId) {
        return res.status(400).json({
          success: false,
          message:
            "Provide either driverId or parentId, not both",
        });
      }

      /* ===================================================
         DRIVER TOKEN
      =================================================== */

      if (driverId) {
        let driver = null;

        /*
          Backwards compatibility:

          Some old frontend code may still send
          MongoDB Driver _id.

          New Driver APIs normally use custom IDs such as:

          ASAN-9D0A01
        */

        if (
          mongoose.Types.ObjectId.isValid(
            String(driverId)
          )
        ) {
          driver =
            await Driver.findById(
              driverId
            );
        }

        /*
          If MongoDB _id lookup did not find a Driver,
          try the custom Driver ID.
        */

        if (!driver) {
          const normalizedDriverId =
            normalizeDriverId(
              driverId
            );

          driver =
            await Driver.findOne({
              driverId:
                normalizedDriverId,
            });
        }

        if (!driver) {
          return res.status(404).json({
            success: false,
            message: "Driver not found",
          });
        }

        /*
          $addToSet avoids duplicate tokens.
        */

        await Driver.updateOne(
          {
            _id: driver._id,
          },
          {
            $addToSet: {
              fcmTokens:
                normalizedToken,
            },
          }
        );

        return res.status(200).json({
          success: true,
          message:
            "Driver notification token saved successfully",
        });
      }

      /* ===================================================
         PARENT TOKEN
      =================================================== */

      if (
        !mongoose.Types.ObjectId.isValid(
          String(parentId)
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid Parent ID",
        });
      }

      const parent =
        await Parent.findById(
          parentId
        );

      if (!parent) {
        return res.status(404).json({
          success: false,
          message: "Parent not found",
        });
      }

      await Parent.updateOne(
        {
          _id: parent._id,
        },
        {
          $addToSet: {
            fcmTokens:
              normalizedToken,
          },
        }
      );

      return res.status(200).json({
        success: true,
        message:
          "Parent notification token saved successfully",
      });
    } catch (error) {
      console.error(
        "SAVE NOTIFICATION TOKEN ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to save notification token",
      });
    }
  }
);

/* =========================================================
   FETCH NOTIFICATIONS
========================================================= */

/*
  Driver notifications.

  Existing controller contract is preserved.
*/

router.get(
  "/",
  getNotifications
);

/*
  All notifications.

  This should eventually become Admin-only.
*/

router.get(
  "/all",
  getAllNotifications
);

/*
  Parent notification history.
*/

router.get(
  "/parent/:parentId",
  getParentNotifications
);

/* =========================================================
   MARK ALL AS READ
========================================================= */

/*
  IMPORTANT:

  This MUST be defined before:

  /:id/read

  Otherwise Express could interpret:

  "read-all"

  as an arbitrary notification ID.
*/

router.put(
  "/read-all",
  markAllAsRead
);

/* =========================================================
   MARK SINGLE NOTIFICATION AS READ
========================================================= */

router.put(
  "/:id/read",
  markAsRead
);

/* =========================================================
   EXPORT
========================================================= */

export default router;
