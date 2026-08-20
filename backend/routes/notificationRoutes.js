import express from "express";
import mongoose from "mongoose";

import Notification from "../models/Notification.js";

import {
  getNotifications,
  getAllNotifications,
  getParentNotifications,
  markAsRead,
  markAllAsRead,
  sendTestNotification,
} from "../controllers/notificationController.js";

import verifyDriver from "../middleware/verifyDriver.js";
import verifyParent from "../middleware/verifyParent.js";
import verifyAdmin from "../middleware/verifyAdmin.js";

const router = express.Router();

/* =========================================================
   HELPERS
========================================================= */

const normalizeDriverId = (driverId) => {
  return String(driverId || "")
    .trim()
    .toUpperCase();
};

/* =========================================================
   VERIFY PARENT PARAM OWNERSHIP
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
    ).trim();

  const authenticatedParentId =
    String(
      req.parent?._id ||
        ""
    ).trim();

  if (!requestedParentId) {
    return res.status(400).json({
      success: false,
      message:
        "Parent ID is required",
    });
  }

  if (!authenticatedParentId) {
    return res.status(401).json({
      success: false,
      message:
        "Parent authentication required",
    });
  }

  if (
    requestedParentId !==
    authenticatedParentId
  ) {
    return res.status(403).json({
      success: false,
      message:
        "You cannot access another Parent's notifications",
    });
  }

  return next();
};

/* =========================================================
   AUTHORIZE MARK-ALL REQUEST
========================================================= */

const authorizeReadAll = (
  req,
  res,
  next
) => {
  const {
    driverId,
    parentId,
  } =
    req.query || {};

  /* =======================================================
     EXACTLY ONE RECIPIENT
  ======================================================= */

  if (
    driverId &&
    parentId
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Provide either driverId or parentId, not both",
    });
  }

  if (
    !driverId &&
    !parentId
  ) {
    return res.status(400).json({
      success: false,
      message:
        "driverId or parentId is required",
    });
  }

  /* =======================================================
     DRIVER
  ======================================================= */

  if (driverId) {
    return verifyDriver(
      req,
      res,

      () => {
        const requestedDriverId =
          normalizeDriverId(
            driverId
          );

        const authenticatedDriverId =
          normalizeDriverId(
            req.driver?.driverId
          );

        if (
          !requestedDriverId ||
          !authenticatedDriverId ||
          requestedDriverId !==
            authenticatedDriverId
        ) {
          return res.status(403).json({
            success: false,
            message:
              "You cannot modify another Driver's notifications",
          });
        }

        req.notificationRecipient = {
          type: "driver",

          driverId:
            authenticatedDriverId,
        };

        return next();
      }
    );
  }

  /* =======================================================
     PARENT
  ======================================================= */

  if (
    !mongoose.Types.ObjectId.isValid(
      String(parentId)
    )
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Invalid Parent ID",
    });
  }

  return verifyParent(
    req,
    res,

    () => {
      const authenticatedParentId =
        String(
          req.parent?._id ||
            ""
        );

      if (
        String(parentId) !==
        authenticatedParentId
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You cannot modify another Parent's notifications",
        });
      }

      req.notificationRecipient = {
        type: "parent",

        parentId:
          req.parent._id,
      };

      return next();
    }
  );
};

/* =========================================================
   AUTHORIZE SINGLE NOTIFICATION
========================================================= */

const authorizeSingleNotification =
  async (
    req,
    res,
    next
  ) => {
    try {
      const {
        id,
      } =
        req.params;

      /* ===================================================
         VALIDATE NOTIFICATION ID
      =================================================== */

      if (
        !mongoose.Types.ObjectId.isValid(
          String(id)
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid Notification ID",
        });
      }

      /* ===================================================
         FIND NOTIFICATION
      =================================================== */

      const notification =
        await Notification.findById(
          id
        ).select(
          "_id recipientType driver parent"
        );

      if (!notification) {
        return res.status(404).json({
          success: false,
          message:
            "Notification not found",
        });
      }

      /* ===================================================
         DRIVER NOTIFICATION
      =================================================== */

      if (
        notification.recipientType ===
        "driver"
      ) {
        return verifyDriver(
          req,
          res,

          () => {
            const notificationDriverId =
              normalizeDriverId(
                notification.driver
              );

            const authenticatedDriverId =
              normalizeDriverId(
                req.driver?.driverId
              );

            if (
              !notificationDriverId ||
              !authenticatedDriverId ||
              notificationDriverId !==
                authenticatedDriverId
            ) {
              return res.status(403).json({
                success: false,
                message:
                  "You cannot modify another Driver's notification",
              });
            }

            req.notificationRecipient = {
              type: "driver",

              driverId:
                authenticatedDriverId,
            };

            return next();
          }
        );
      }

      /* ===================================================
         PARENT NOTIFICATION
      =================================================== */

      if (
        notification.recipientType ===
        "parent"
      ) {
        return verifyParent(
          req,
          res,

          () => {
            if (
              !notification.parent ||
              String(
                notification.parent
              ) !==
                String(
                  req.parent?._id
                )
            ) {
              return res.status(403).json({
                success: false,
                message:
                  "You cannot modify another Parent's notification",
              });
            }

            req.notificationRecipient = {
              type: "parent",

              parentId:
                req.parent._id,
            };

            return next();
          }
        );
      }

      return res.status(403).json({
        success: false,
        message:
          "Invalid notification recipient",
      });
    } catch (error) {
      console.error(
        "NOTIFICATION AUTHORIZATION ERROR:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Notification authorization failed",
      });
    }
  };

/* =========================================================
   TEST NOTIFICATION
   ADMIN ONLY
========================================================= */

router.post(
  "/test",

  verifyAdmin,

  sendTestNotification
);

/* =========================================================
   FCM TOKEN REGISTRATION
========================================================= */

/*
  Parent:

  POST /api/auth/save-token

  Authorization:
  Bearer <ASAN_PARENT_JWT>


  Driver:

  POST /api/driver/save-token

  Authorization:
  Bearer <ASAN_DRIVER_JWT>


  Firebase is still used for FCM delivery only.
  Firebase Authentication is no longer used.
*/

/* =========================================================
   DRIVER NOTIFICATION HISTORY
========================================================= */

router.get(
  "/",

  verifyDriver,

  getNotifications
);

/* =========================================================
   ALL NOTIFICATIONS
   ADMIN ONLY
========================================================= */

router.get(
  "/all",

  verifyAdmin,

  getAllNotifications
);

/* =========================================================
   PARENT NOTIFICATION HISTORY
========================================================= */

router.get(
  "/parent/:parentId",

  verifyParent,

  requireOwnParentParam,

  getParentNotifications
);

/* =========================================================
   MARK ALL AS READ
========================================================= */

router.put(
  "/read-all",

  authorizeReadAll,

  markAllAsRead
);

/* =========================================================
   MARK SINGLE NOTIFICATION AS READ
========================================================= */

router.put(
  "/:id/read",

  authorizeSingleNotification,

  markAsRead
);

/* =========================================================
   EXPORT
========================================================= */

export default router;
