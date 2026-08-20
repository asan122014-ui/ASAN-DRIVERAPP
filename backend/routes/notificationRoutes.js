import express from "express";
import mongoose from "mongoose";

import Notification from "../models/Notification.js";
import Parent from "../models/Parent.js";

import {
  getNotifications,
  getAllNotifications,
  getParentNotifications,
  markAsRead,
  markAllAsRead,
  sendTestNotification,
} from "../controllers/notificationController.js";

import verifyDriver from "../middleware/verifyDriver.js";
import verifyAdmin from "../middleware/verifyAdmin.js";
import verifyFirebaseToken from "../middleware/verifyFirebaseToken.js";

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
   LOAD AUTHENTICATED PARENT
========================================================= */

const requireParentAccount = async (
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

    req.parent =
      parent;

    return next();
  } catch (error) {
    console.error(
      "LOAD NOTIFICATION PARENT ERROR:",
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
   VERIFY PARENT PARAM OWNERSHIP
========================================================= */

const requireOwnParentParam = (
  req,
  res,
  next
) => {
  const parentId =
    String(
      req.params?.parentId ||
        ""
    ).trim();

  if (!parentId) {
    return res.status(400).json({
      success: false,

      message:
        "Parent ID is required",
    });
  }

  if (
    parentId !==
    String(
      req.parent._id
    )
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

/*
  Supported:

  DRIVER

  PUT /api/notifications/read-all?driverId=ASAN-XXXXXX

  PARENT

  PUT /api/notifications/read-all?parentId=<MongoId>

  The ID supplied through query parameters is never
  trusted by itself.

  Authentication must prove ownership.
*/

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
          type:
            "driver",

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
      String(
        parentId
      )
    )
  ) {
    return res.status(400).json({
      success: false,

      message:
        "Invalid Parent ID",
    });
  }

  return verifyFirebaseToken(
    req,
    res,

    () => {
      return requireParentAccount(
        req,
        res,

        () => {
          if (
            String(
              parentId
            ) !==
            String(
              req.parent._id
            )
          ) {
            return res.status(403).json({
              success: false,

              message:
                "You cannot modify another Parent's notifications",
            });
          }

          req.notificationRecipient = {
            type:
              "parent",

            parentId:
              req.parent._id,
          };

          return next();
        }
      );
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
          String(
            id
          )
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
              type:
                "driver",

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
        return verifyFirebaseToken(
          req,
          res,

          () => {
            return requireParentAccount(
              req,
              res,

              () => {
                if (
                  !notification.parent ||
                  String(
                    notification.parent
                  ) !==
                    String(
                      req.parent._id
                    )
                ) {
                  return res.status(403).json({
                    success: false,

                    message:
                      "You cannot modify another Parent's notification",
                  });
                }

                req.notificationRecipient = {
                  type:
                    "parent",

                  parentId:
                    req.parent._id,
                };

                return next();
              }
            );
          }
        );
      }

      /* ===================================================
         UNKNOWN RECIPIENT
      =================================================== */

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
   SAVE FCM TOKEN
========================================================= */

/*
  There is intentionally NO token-registration
  endpoint here.

  Parent:

  POST /api/auth/save-token

  Firebase authenticated.

  Driver:

  POST /api/driver/save-token

  Driver JWT authenticated.
*/

/* =========================================================
   DRIVER NOTIFICATION HISTORY
========================================================= */

/*
  IMPORTANT:

  GET /api/notifications

  This route should return BOTH:

  read: false
  read: true

  notifications.

  Opening Notifications changes read status,
  but read notifications must remain in the feed
  until MongoDB TTL deletes them after 4 days.

  Driver identity comes only from Driver JWT.
*/

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

/*
  Example:

  GET /api/notifications/parent/68abc123...
*/

router.get(
  "/parent/:parentId",

  verifyFirebaseToken,

  requireParentAccount,

  requireOwnParentParam,

  getParentNotifications
);

/* =========================================================
   MARK ALL AS READ
========================================================= */

/*
  DRIVER:

  PUT /api/notifications/read-all
      ?driverId=ASAN-XXXXXX

  PARENT:

  PUT /api/notifications/read-all
      ?parentId=<MongoId>

  This should ONLY update:

  read   -> true
  readAt -> current time

  It must NEVER delete notifications.
*/

router.put(
  "/read-all",

  authorizeReadAll,

  markAllAsRead
);

/* =========================================================
   MARK SINGLE NOTIFICATION AS READ
========================================================= */

/*
  Example:

  PUT /api/notifications/68abc123/read

  Frontend currently uses this endpoint when automatically
  marking notifications as read.
*/

router.put(
  "/:id/read",

  authorizeSingleNotification,

  markAsRead
);

/* =========================================================
   EXPORT
========================================================= */

export default router;
