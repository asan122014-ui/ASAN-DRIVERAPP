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
  if (!driverId) {
    return "";
  }

  return String(driverId)
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
    String(value)
  );
};

/* =========================================================
   BUILD NOTIFICATION FILTER
========================================================= */

/*
  Supported combinations:

  driverId
  parentId
  childId

  childId can also be combined with
  driverId or parentId.

  driverId + parentId together is not allowed.
*/

const buildNotificationFilter = ({
  driverId,
  parentId,
  childId,
}) => {
  if (
    driverId &&
    parentId
  ) {
    const error = new Error(
      "Provide either driverId or parentId, not both"
    );

    error.statusCode = 400;

    throw error;
  }

  if (
    !driverId &&
    !parentId &&
    !childId
  ) {
    const error = new Error(
      "driverId, parentId or childId is required"
    );

    error.statusCode = 400;

    throw error;
  }

  const filter = {};

  /* =====================================================
     DRIVER
  ===================================================== */

  if (driverId) {
    filter.driver =
      normalizeDriverId(
        driverId
      );

    filter.recipientType =
      "driver";
  }

  /* =====================================================
     PARENT
  ===================================================== */

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

      error.statusCode = 400;

      throw error;
    }

    filter.parent =
      parentId;

    filter.recipientType =
      "parent";
  }

  /* =====================================================
     CHILD
  ===================================================== */

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

      error.statusCode = 400;

      throw error;
    }

    filter.child =
      childId;
  }

  return filter;
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
    error.message
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
   GET UNREAD NOTIFICATIONS
========================================================= */

/*
  Used for:

  notification badge
  unread notification list

  Examples:

  GET /api/notifications?driverId=ASAN-XXXXXX

  GET /api/notifications?parentId=<MongoId>

  GET /api/notifications?childId=<MongoId>
*/

export const getNotifications =
  async (
    req,
    res
  ) => {
    try {
      const {
        driverId,
        parentId,
        childId,
      } = req.query;

      const filter =
        buildNotificationFilter(
          {
            driverId,
            parentId,
            childId,
          }
        );

      filter.read =
        false;

      const notifications =
        await Notification.find(
          filter
        )
          .sort({
            createdAt: -1,
          })
          .lean();

      return res
        .status(200)
        .json({
          success: true,

          count:
            notifications.length,

          unreadCount:
            notifications.length,

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
   GET ALL NOTIFICATIONS / HISTORY
========================================================= */

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
      } = req.query;

      const filter =
        buildNotificationFilter(
          {
            driverId,
            parentId,
            childId,
          }
        );

      /* ===================================================
         OPTIONAL TYPE FILTER
      =================================================== */

      if (type) {
        filter.type =
          String(type)
            .trim()
            .toLowerCase();
      }

      /* ===================================================
         OPTIONAL PRIORITY FILTER
      =================================================== */

      if (
        priority
      ) {
        const normalizedPriority =
          String(
            priority
          )
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
              success:
                false,

              message:
                "Priority must be low, medium or high",
            });
        }

        filter.priority =
          normalizedPriority;
      }

      const notifications =
        await Notification.find(
          filter
        )
          .sort({
            createdAt: -1,
          })
          .lean();

      const unreadCount =
        notifications.filter(
          (
            notification
          ) =>
            !notification.read
        ).length;

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

export const getParentNotifications =
  async (
    req,
    res
  ) => {
    try {
      const {
        parentId,
      } = req.params;

      if (!parentId) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Parent ID is required",
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
         VERIFY PARENT EXISTS
      =================================================== */

      const parentExists =
        await Parent.exists({
          _id:
            parentId,
        });

      if (
        !parentExists
      ) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Parent not found",
          });
      }

      /* ===================================================
         FETCH
      =================================================== */

      const notifications =
        await Notification.find({
          parent:
            parentId,

          recipientType:
            "parent",
        })
          .sort({
            createdAt: -1,
          })
          .lean();

      const unreadCount =
        notifications.filter(
          (
            notification
          ) =>
            !notification.read
        ).length;

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
        "Failed to fetch parent notifications"
      );
    }
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
      } = req.params;

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

      const notification =
        await Notification.findById(
          id
        );

      if (
        !notification
      ) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Notification not found",
          });
      }

      /* ===================================================
         USE MODEL METHOD
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
      const {
        driverId,
        parentId,
        childId,
      } = req.query;

      const filter =
        buildNotificationFilter(
          {
            driverId,
            parentId,
            childId,
          }
        );

      filter.read =
        false;

      const readAt =
        new Date();

      const result =
        await Notification.updateMany(
          filter,

          {
            $set: {
              read: true,

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
========================================================= */

/*
  Development/testing endpoint.

  POST /api/notifications/test

  {
    "parentId": "..."
  }

  This sends FCM only.
  It does NOT create a real Notification DB entry.
*/

export const sendTestNotification =
  async (
    req,
    res
  ) => {
    try {
      const {
        parentId,
      } = req.body;

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
         FIREBASE CONFIGURATION
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
         DEDUPLICATE TOKENS
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
        !tokens.length
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
         FIREBASE MAX MULTICAST SIZE
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
            .sendEachForMulticast(
              {
                tokens:
                  chunk,

                notification:
                  {
                    title:
                      "Test Notification",

                    body:
                      "FCM is working properly",
                  },

                android: {
                  priority:
                    "high",

                  notification:
                    {
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
              }
            );

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
              item.error
                ?.code;

            if (
              INVALID_FCM_TOKEN_CODES.has(
                code
              )
            ) {
              invalidTokens.push(
                chunk[index]
              );
            }
          }
        );
      }

      /* ===================================================
         REMOVE INVALID TOKENS
      =================================================== */

      if (
        invalidTokens.length
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
                  invalidTokens,
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
              invalidTokens.length,
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
