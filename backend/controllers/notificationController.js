import mongoose from "mongoose";

import Notification from "../models/Notification.js";
import Parent from "../models/Parent.js";

import {
  parentMessaging,
} from "../config/firebaseAdmin.js";

/* =========================================================
   CONSTANTS
========================================================= */

const INVALID_FCM_TOKEN_CODES =
  new Set([
    "messaging/registration-token-not-registered",
    "messaging/invalid-registration-token",
  ]);

/* =========================================================
   HELPERS
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
   OBJECT ID VALIDATION
========================================================= */

const isValidObjectId = (
  value
) => {
  return mongoose.Types.ObjectId.isValid(
    String(
      value || ""
    )
  );
};

/* =========================================================
   ADMIN FILTER BUILDER
========================================================= */

/*
  Used only by the Admin notification-history endpoint.

  Admin can optionally filter by:

  - driverId
  - parentId
  - childId

  Empty recipient filters are allowed so Admin can
  retrieve all notifications.
*/

const buildAdminNotificationFilter = ({
  driverId,
  parentId,
  childId,
}) => {
  if (
    driverId &&
    parentId
  ) {
    const error =
      new Error(
        "Provide either driverId or parentId, not both"
      );

    error.statusCode =
      400;

    throw error;
  }

  const filter = {};

  /* =======================================================
     DRIVER
  ======================================================= */

  if (driverId) {
    const normalizedDriverId =
      normalizeDriverId(
        driverId
      );

    if (
      !normalizedDriverId
    ) {
      const error =
        new Error(
          "Invalid Driver ID"
        );

      error.statusCode =
        400;

      throw error;
    }

    filter.driver =
      normalizedDriverId;

    filter.recipientType =
      "driver";
  }

  /* =======================================================
     PARENT
  ======================================================= */

  if (parentId) {
    if (
      !isValidObjectId(
        parentId
      )
    ) {
      const error =
        new Error(
          "Invalid Parent ID"
        );

      error.statusCode =
        400;

      throw error;
    }

    filter.parent =
      parentId;

    filter.recipientType =
      "parent";
  }

  /* =======================================================
     CHILD
  ======================================================= */

  if (childId) {
    if (
      !isValidObjectId(
        childId
      )
    ) {
      const error =
        new Error(
          "Invalid Child ID"
        );

      error.statusCode =
        400;

      throw error;
    }

    filter.child =
      childId;
  }

  return filter;
};

/* =========================================================
   OPTIONAL CHILD FILTER
========================================================= */

const addChildFilter = (
  filter,
  childId
) => {
  if (!childId) {
    return;
  }

  if (
    !isValidObjectId(
      childId
    )
  ) {
    const error =
      new Error(
        "Invalid Child ID"
      );

    error.statusCode =
      400;

    throw error;
  }

  filter.child =
    childId;
};

/* =========================================================
   ERROR RESPONSE
========================================================= */

const handleControllerError = (
  error,
  res,
  fallbackMessage
) => {
  console.error(
    fallbackMessage,
    error
  );

  if (
    error.statusCode
  ) {
    return res
      .status(
        error.statusCode
      )
      .json({
        success: false,

        message:
          error.message,
      });
  }

  return res
    .status(500)
    .json({
      success: false,

      message:
        fallbackMessage,
    });
};

/* =========================================================
   GET DRIVER NOTIFICATIONS
========================================================= */

/*
  SECURITY:

  Driver identity comes only from verifyDriver.

  req.query.driverId is ignored.

  IMPORTANT:

  This returns BOTH:

  read: false
  read: true

  Read notifications remain visible until MongoDB TTL
  removes them 4 days after createdAt.
*/

export const getNotifications =
  async (
    req,
    res
  ) => {
    try {
      const driverId =
        normalizeDriverId(
          req.driver?.driverId
        );

      if (!driverId) {
        return res.status(401).json({
          success: false,

          message:
            "Driver authentication required",
        });
      }

      /* ===================================================
         DRIVER FILTER

         DO NOT add read:false here.
      =================================================== */

      const filter = {
        driver:
          driverId,

        recipientType:
          "driver",
      };

      /* ===================================================
         OPTIONAL CHILD FILTER
      =================================================== */

      addChildFilter(
        filter,
        req.query?.childId
      );

      /* ===================================================
         FETCH ALL DRIVER NOTIFICATIONS
      =================================================== */

      const notifications =
        await Notification.find(
          filter
        )
          .sort({
            createdAt:
              -1,
          })
          .lean();

      /* ===================================================
         UNREAD COUNT
      =================================================== */

      const unreadCount =
        notifications.reduce(
          (
            count,
            notification
          ) => {
            return notification.read
              ? count
              : count + 1;
          },
          0
        );

      /* ===================================================
         RESPONSE
      =================================================== */

      return res
        .status(200)
        .json({
          success: true,

          /*
            Total notifications still stored
            inside the 4-day retention period.
          */

          count:
            notifications.length,

          /*
            Used by Dashboard bell.
          */

          unreadCount,

          /*
            Contains BOTH read and unread.
          */

          data:
            notifications,
        });
    } catch (error) {
      return handleControllerError(
        error,
        res,
        "Failed to fetch notifications"
      );
    }
  };

/* =========================================================
   GET ALL NOTIFICATIONS
   ADMIN ONLY
========================================================= */

/*
  Route protection is handled by verifyAdmin.

  Admin may retrieve everything or filter by:

  driverId
  parentId
  childId
  type
  priority
*/

export const getAllNotifications =
  async (
    req,
    res
  ) => {
    try {
      const {
        driverId,
        parentId,
        childId,
        type,
        priority,
      } =
        req.query || {};

      const filter =
        buildAdminNotificationFilter({
          driverId,
          parentId,
          childId,
        });

      /* ===================================================
         TYPE
      =================================================== */

      if (type) {
        filter.type =
          String(type)
            .trim()
            .toLowerCase();
      }

      /* ===================================================
         PRIORITY
      =================================================== */

      if (priority) {
        const normalizedPriority =
          String(priority)
            .trim()
            .toLowerCase();

        if (
          ![
            "low",
            "medium",
            "high",
          ].includes(
            normalizedPriority
          )
        ) {
          return res
            .status(400)
            .json({
              success: false,

              message:
                "Priority must be low, medium or high",
            });
        }

        filter.priority =
          normalizedPriority;
      }

      /* ===================================================
         FETCH
      =================================================== */

      const notifications =
        await Notification.find(
          filter
        )
          .sort({
            createdAt:
              -1,
          })
          .lean();

      const unreadCount =
        notifications.reduce(
          (
            count,
            notification
          ) =>
            notification.read
              ? count
              : count + 1,

          0
        );

      return res
        .status(200)
        .json({
          success: true,

          count:
            notifications.length,

          unreadCount,

          data:
            notifications,
        });
    } catch (error) {
      return handleControllerError(
        error,
        res,
        "Failed to fetch notifications"
      );
    }
  };

/* =========================================================
   GET PARENT NOTIFICATIONS
========================================================= */

/*
  SECURITY:

  Parent identity comes from:

  Firebase token
  ↓
  req.parent

  parentId from the URL has already been ownership checked
  by notificationRoutes.js.

  Both read and unread notifications are returned.
*/

export const getParentNotifications =
  async (
    req,
    res
  ) => {
    try {
      const parent =
        req.parent;

      if (!parent) {
        return res
          .status(401)
          .json({
            success: false,

            message:
              "Parent authentication required",
          });
      }

      const notifications =
        await Notification.find({
          parent:
            parent._id,

          recipientType:
            "parent",
        })
          .sort({
            createdAt:
              -1,
          })
          .lean();

      const unreadCount =
        notifications.reduce(
          (
            count,
            notification
          ) =>
            notification.read
              ? count
              : count + 1,

          0
        );

      return res
        .status(200)
        .json({
          success: true,

          count:
            notifications.length,

          unreadCount,

          data:
            notifications,
        });
    } catch (error) {
      return handleControllerError(
        error,
        res,
        "Failed to fetch Parent notifications"
      );
    }
  };

/* =========================================================
   BUILD AUTHENTICATED RECIPIENT FILTER
========================================================= */

const getAuthenticatedRecipientFilter = (
  req
) => {
  const recipient =
    req.notificationRecipient;

  if (!recipient) {
    const error =
      new Error(
        "Notification authentication required"
      );

    error.statusCode =
      401;

    throw error;
  }

  /* =======================================================
     DRIVER
  ======================================================= */

  if (
    recipient.type ===
    "driver"
  ) {
    const driverId =
      normalizeDriverId(
        recipient.driverId
      );

    if (!driverId) {
      const error =
        new Error(
          "Invalid Driver notification recipient"
        );

      error.statusCode =
        401;

      throw error;
    }

    return {
      driver:
        driverId,

      recipientType:
        "driver",
    };
  }

  /* =======================================================
     PARENT
  ======================================================= */

  if (
    recipient.type ===
    "parent"
  ) {
    if (
      !isValidObjectId(
        recipient.parentId
      )
    ) {
      const error =
        new Error(
          "Invalid Parent notification recipient"
        );

      error.statusCode =
        401;

      throw error;
    }

    return {
      parent:
        recipient.parentId,

      recipientType:
        "parent",
    };
  }

  const error =
    new Error(
      "Invalid notification recipient"
    );

  error.statusCode =
    403;

  throw error;
};

/* =========================================================
   MARK SINGLE NOTIFICATION AS READ
========================================================= */

export const markAsRead =
  async (
    req,
    res
  ) => {
    try {
      const {
        id,
      } =
        req.params;

      if (
        !isValidObjectId(
          id
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Invalid Notification ID",
          });
      }

      /* ===================================================
         AUTHENTICATED OWNER FILTER
      =================================================== */

      const ownerFilter =
        getAuthenticatedRecipientFilter(
          req
        );

      /*
        Defense in depth:

        notificationRoutes.js already checks ownership.

        We also query using recipient ownership here.
      */

      const notification =
        await Notification.findOne({
          _id:
            id,

          ...ownerFilter,
        });

      if (!notification) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Notification not found",
          });
      }

      /* ===================================================
         ALREADY READ
      =================================================== */

      if (
        notification.read
      ) {
        return res
          .status(200)
          .json({
            success: true,

            message:
              "Notification already read",

            data:
              notification,
          });
      }

      /* ===================================================
         MARK READ

         IMPORTANT:
         THIS DOES NOT DELETE THE NOTIFICATION.
      =================================================== */

      await notification.markAsRead();

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Notification marked as read",

          data:
            notification,
        });
    } catch (error) {
      return handleControllerError(
        error,
        res,
        "Failed to update notification"
      );
    }
  };

/* =========================================================
   MARK ALL AS READ
========================================================= */

export const markAllAsRead =
  async (
    req,
    res
  ) => {
    try {
      /* ===================================================
         AUTHENTICATED RECIPIENT
      =================================================== */

      const filter =
        getAuthenticatedRecipientFilter(
          req
        );

      /* ===================================================
         OPTIONAL CHILD FILTER
      =================================================== */

      addChildFilter(
        filter,
        req.query?.childId
      );

      /*
        Only unread records need updating.
      */

      filter.read =
        false;

      const readAt =
        new Date();

      /* ===================================================
         UPDATE

         IMPORTANT:

         This only changes:

         read   = true
         readAt = current time

         Nothing is deleted.
      =================================================== */

      const result =
        await Notification.updateMany(
          filter,

          {
            $set: {
              read:
                true,

              readAt,
            },
          }
        );

      return res
        .status(200)
        .json({
          success: true,

          message:
            "All notifications marked as read",

          modifiedCount:
            result.modifiedCount,
        });
    } catch (error) {
      return handleControllerError(
        error,
        res,
        "Failed to update notifications"
      );
    }
  };

/* =========================================================
   TEST PARENT FCM
   ADMIN ONLY
========================================================= */

/*
  Route:

  POST /api/notifications/test

  Protected by verifyAdmin.

  Testing utility only.

  Sends FCM but does not create a real
  Notification database record.
*/

export const sendTestNotification =
  async (
    req,
    res
  ) => {
    try {
      const {
        parentId,
      } =
        req.body || {};

      /* ===================================================
         PARENT ID
      =================================================== */

      if (!parentId) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "parentId is required",
          });
      }

      if (
        !isValidObjectId(
          parentId
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Invalid Parent ID",
          });
      }

      /* ===================================================
         FIREBASE
      =================================================== */

      if (
        !parentMessaging
      ) {
        return res
          .status(503)
          .json({
            success: false,

            message:
              "Parent Firebase Messaging is unavailable",
          });
      }

      /* ===================================================
         FIND PARENT
      =================================================== */

      const parent =
        await Parent.findById(
          parentId
        );

      if (!parent) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Parent not found",
          });
      }

      /* ===================================================
         DEDUPLICATE FCM TOKENS
      =================================================== */

      const tokens = [
        ...new Set(
          parent.fcmTokens ||
            []
        ),
      ].filter(
        (token) =>
          typeof token ===
            "string" &&
          token.trim() !==
            ""
      );

      if (
        tokens.length ===
        0
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "FCM tokens not found",
          });
      }

      /* ===================================================
         FIREBASE MULTICAST CHUNKS
      =================================================== */

      const chunks =
        [];

      for (
        let index = 0;
        index <
        tokens.length;
        index += 500
      ) {
        chunks.push(
          tokens.slice(
            index,
            index + 500
          )
        );
      }

      let successCount =
        0;

      let failureCount =
        0;

      const invalidTokens =
        [];

      /* ===================================================
         SEND
      =================================================== */

      for (
        const chunk of
        chunks
      ) {
        const response =
          await parentMessaging
            .sendEachForMulticast({
              tokens:
                chunk,

              notification: {
                title:
                  "Test Notification",

                body:
                  "FCM is working properly",
              },

              android: {
                priority:
                  "high",

                notification: {
                  sound:
                    "default",
                },
              },

              data: {
                type:
                  "general",

                test:
                  "true",
              },
            });

        successCount +=
          response.successCount;

        failureCount +=
          response.failureCount;

        response.responses.forEach(
          (
            item,
            index
          ) => {
            if (
              item.success
            ) {
              return;
            }

            const code =
              item.error?.code;

            if (
              INVALID_FCM_TOKEN_CODES.has(
                code
              )
            ) {
              invalidTokens.push(
                chunk[
                  index
                ]
              );
            }
          }
        );
      }

      /* ===================================================
         REMOVE INVALID TOKENS
      =================================================== */

      const uniqueInvalidTokens = [
        ...new Set(
          invalidTokens
        ),
      ];

      if (
        uniqueInvalidTokens.length >
        0
      ) {
        await Parent.updateOne(
          {
            _id:
              parent._id,
          },

          {
            $pull: {
              fcmTokens: {
                $in:
                  uniqueInvalidTokens,
              },
            },
          }
        );
      }

      console.log(
        `Test Parent FCM: ${successCount} delivered, ${failureCount} failed`
      );

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Test notification processed",

          data: {
            successCount,

            failureCount,

            removedInvalidTokens:
              uniqueInvalidTokens.length,
          },
        });
    } catch (error) {
      return handleControllerError(
        error,
        res,
        "Failed to send notification"
      );
    }
  };
