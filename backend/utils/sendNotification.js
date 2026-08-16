import Notification from "../models/Notification.js";
import Parent from "../models/Parent.js";
import Driver from "../models/Driver.js";
import Child from "../models/Child.js";

import {
  driverMessaging,
  parentMessaging,
} from "../config/firebaseAdmin.js";

import {
  PARENT_NOTIFICATIONS,
  DRIVER_NOTIFICATIONS,
} from "./notificationMessages.js";

/* =========================================================
   NOTIFICATION TYPE MAP
========================================================= */

/*
  notificationKey = application event

  Example:
  TRIP_STARTED

  type = normalized database category

  Example:
  trip_started
*/

const NOTIFICATION_TYPE_MAP = Object.freeze({
  TRIP_STARTED:
    "trip_started",

  RETURN_TRIP_STARTED:
    "return_trip_started",

  TRIP_COMPLETED:
    "trip_completed",

  DRIVER_ARRIVED_PICKUP:
    "driver_arrived_pickup",

  CHILD_PICKED_UP:
    "student_picked_up",

  APPROACHING_SCHOOL:
    "approaching_school",

  DROPPED_AT_SCHOOL:
    "student_dropped",

  DRIVER_ARRIVED_SCHOOL:
    "driver_arrived_school",

  PICKED_UP_FROM_SCHOOL:
    "student_picked_up",

  APPROACHING_HOME:
    "approaching_home",

  DROPPED_AT_HOME:
    "student_dropped",

  TRIP_DELAYED:
    "trip_delayed",

  TRIP_CANCELLED:
    "trip_cancelled",

  PAYMENT_RECEIVED:
    "payment_received",

  MORNING_DROP_PHOTO_UPLOADED:
    "morning_drop_photo_uploaded",

  MORNING_DROP_VERIFIED:
    "morning_drop_verified",

  AFTERNOON_PICKUP_PHOTO_UPLOADED:
    "afternoon_pickup_photo_uploaded",

  AFTERNOON_PICKUP_VERIFIED:
    "afternoon_pickup_verified",

  DRIVER_REQUEST_SUBMITTED:
    "driver_request_submitted",

  DRIVER_REQUEST_ACCEPTED:
    "driver_request_accepted",

  DRIVER_ASSIGNED:
    "driver_assigned",

  DRIVER_CHANGED:
    "driver_changed",

  GENERAL_ANNOUNCEMENT:
    "general",

  EMERGENCY_ALERT:
    "emergency",
});

/* =========================================================
   INVALID FCM TOKEN ERROR CODES
========================================================= */

const INVALID_TOKEN_CODES =
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
   PLACEHOLDER REPLACEMENT
========================================================= */

const replacePlaceholders = (
  text = "",
  data = {}
) => {
  return String(text)
    .replace(
      /{childName}/g,
      data.childName ||
        "Your child"
    )
    .replace(
      /{driverName}/g,
      data.driverName ||
        "Driver"
    )
    .replace(
      /{schoolName}/g,
      data.schoolName ||
        "School"
    );
};

/* =========================================================
   CLEAN TOKEN ARRAY
========================================================= */

const getValidTokens = (
  tokens = []
) => {
  return [
    ...new Set(tokens),
  ].filter(
    (token) =>
      typeof token ===
        "string" &&
      token.trim() !== ""
  );
};

/* =========================================================
   CHUNK ARRAY
========================================================= */

/*
  Firebase multicast calls should not contain
  excessively large token arrays.

  Bus/Driver groups are normally much smaller,
  but chunking makes this safe.
*/

const chunkArray = (
  array,
  size = 500
) => {
  const chunks = [];

  for (
    let index = 0;
    index < array.length;
    index += size
  ) {
    chunks.push(
      array.slice(
        index,
        index + size
      )
    );
  }

  return chunks;
};

/* =========================================================
   COLLECT INVALID TOKENS
========================================================= */

const getInvalidTokens = (
  response,
  tokens
) => {
  const invalidTokens = [];

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

      console.warn(
        "FCM delivery failure:",
        code ||
          "unknown"
      );

      if (
        INVALID_TOKEN_CODES.has(
          code
        )
      ) {
        invalidTokens.push(
          tokens[index]
        );
      }
    }
  );

  return invalidTokens;
};

/* =========================================================
   SEND PARENT FCM
========================================================= */

const sendParentFCM =
  async ({
    tokens,
    title,
    message,
    driverId,
    childId,
    notificationKey,
    type,
    priority,
  }) => {
    if (
      !tokens.length
    ) {
      return;
    }

    /*
      Parent Firebase Admin app may intentionally
      be unavailable if configuration failed.

      Database + Socket notifications should still work.
    */

    if (
      !parentMessaging
    ) {
      console.warn(
        "Parent Firebase Messaging is unavailable"
      );

      return;
    }

    const tokenChunks =
      chunkArray(tokens);

    const invalidTokens =
      [];

    for (
      const chunk of
      tokenChunks
    ) {
      try {
        const response =
          await parentMessaging
            .sendEachForMulticast({
              tokens:
                chunk,

              notification: {
                title,

                body:
                  message,
              },

              android: {
                priority:
                  "high",

                notification: {
                  sound:
                    "default",
                },
              },

              apns: {
                payload: {
                  aps: {
                    sound:
                      "default",
                  },
                },
              },

              data: {
                driverId:
                  driverId ||
                  "",

                childId:
                  childId
                    ? String(
                        childId
                      )
                    : "",

                notificationKey:
                  String(
                    notificationKey
                  ),

                type:
                  String(
                    type
                  ),

                priority:
                  String(
                    priority
                  ),
              },
            });

        invalidTokens.push(
          ...getInvalidTokens(
            response,
            chunk
          )
        );

        console.log(
          `Parent FCM: ${response.successCount} delivered, ${response.failureCount} failed`
        );
      } catch (error) {
        console.error(
          "Parent FCM error:",
          error.message
        );
      }
    }

    /* =====================================================
       REMOVE INVALID TOKENS
    ===================================================== */

    if (
      invalidTokens.length
    ) {
      try {
        await Parent.updateMany(
          {
            fcmTokens: {
              $in:
                invalidTokens,
            },
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

        console.log(
          `${invalidTokens.length} invalid Parent FCM token(s) removed`
        );
      } catch (error) {
        console.error(
          "Failed to remove invalid Parent tokens:",
          error.message
        );
      }
    }
  };

/* =========================================================
   SEND DRIVER FCM
========================================================= */

const sendDriverFCM =
  async ({
    driver,
    tokens,
    title,
    message,
    driverId,
    childId,
    notificationKey,
    type,
    priority,
  }) => {
    if (
      !tokens.length
    ) {
      return;
    }

    if (
      !driverMessaging
    ) {
      console.warn(
        "Driver Firebase Messaging is unavailable"
      );

      return;
    }

    const tokenChunks =
      chunkArray(tokens);

    const invalidTokens =
      [];

    for (
      const chunk of
      tokenChunks
    ) {
      try {
        const response =
          await driverMessaging
            .sendEachForMulticast({
              tokens:
                chunk,

              notification: {
                title,

                body:
                  message,
              },

              android: {
                priority:
                  "high",

                notification: {
                  sound:
                    "default",
                },
              },

              apns: {
                payload: {
                  aps: {
                    sound:
                      "default",
                  },
                },
              },

              data: {
                driverId:
                  driverId ||
                  "",

                childId:
                  childId
                    ? String(
                        childId
                      )
                    : "",

                notificationKey:
                  String(
                    notificationKey
                  ),

                type:
                  String(
                    type
                  ),

                priority:
                  String(
                    priority
                  ),
              },
            });

        invalidTokens.push(
          ...getInvalidTokens(
            response,
            chunk
          )
        );

        console.log(
          `Driver FCM: ${response.successCount} delivered, ${response.failureCount} failed`
        );
      } catch (error) {
        console.error(
          "Driver FCM error:",
          error.message
        );
      }
    }

    /* =====================================================
       REMOVE INVALID DRIVER TOKENS
    ===================================================== */

    if (
      invalidTokens.length &&
      driver?._id
    ) {
      try {
        await Driver.updateOne(
          {
            _id:
              driver._id,
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

        console.log(
          `${invalidTokens.length} invalid Driver FCM token(s) removed`
        );
      } catch (error) {
        console.error(
          "Failed to remove invalid Driver tokens:",
          error.message
        );
      }
    }
  };

/* =========================================================
   SEND NOTIFICATION
========================================================= */

export const sendNotification =
  async ({
    driverId,

    childId = null,

    notificationKey,

    /*
      Explicit type can still be supplied
      by older routes.

      Otherwise it is automatically mapped
      from notificationKey.
    */
    type = null,

    priority =
      "low",

    meta = {},

    io,
  }) => {
    try {
      /* ===================================================
         VALIDATION
      =================================================== */

      driverId =
        normalizeDriverId(
          driverId
        );

      if (
        !driverId
      ) {
        throw new Error(
          "driverId is required"
        );
      }

      if (
        !notificationKey
      ) {
        throw new Error(
          "notificationKey is required"
        );
      }

      const normalizedKey =
        String(
          notificationKey
        )
          .trim()
          .toUpperCase();

      /* ===================================================
         MESSAGE TEMPLATES
      =================================================== */

      const parentTemplate =
        PARENT_NOTIFICATIONS[
          normalizedKey
        ] || null;

      const driverTemplate =
        DRIVER_NOTIFICATIONS[
          normalizedKey
        ] || null;

      /*
        At least one template must exist.

        We no longer require BOTH to exist.
      */

      if (
        !parentTemplate &&
        !driverTemplate
      ) {
        throw new Error(
          `Invalid notificationKey: ${normalizedKey}`
        );
      }

      /* ===================================================
         RESOLVE TYPE
      =================================================== */

      const resolvedType =
        type ||
        NOTIFICATION_TYPE_MAP[
          normalizedKey
        ] ||
        "general";

      /* ===================================================
         DRIVER
      =================================================== */

      const driver =
        await Driver.findOne({
          driverId,
        }).lean();

      if (!driver) {
        throw new Error(
          "Driver not found"
        );
      }

      /* ===================================================
         CHILD + PARENT
      =================================================== */

      let child =
        null;

      let parents =
        [];

      if (
        childId
      ) {
        child =
          await Child.findById(
            childId
          ).lean();

        if (!child) {
          console.warn(
            "Notification Child not found:",
            String(
              childId
            )
          );
        }

        if (
          child?.parentId
        ) {
          const parent =
            await Parent.findById(
              child.parentId
            ).lean();

          if (
            parent
          ) {
            parents = [
              parent,
            ];
          }
        }
      } else {
        /*
          Whole-driver event such as:

          TRIP_STARTED
          TRIP_COMPLETED

          Send notification to all Parents
          currently linked to the Driver.
        */

        parents =
          await Parent.find({
            driverId,
            isActive: {
              $ne: false,
            },
          }).lean();
      }

      /* ===================================================
         PLACEHOLDER DATA
      =================================================== */

      const notificationData =
        {
          childName:
            child?.name ||
            "Your child",

          driverName:
            driver?.name ||
            "Driver",

          schoolName:
            child?.school ||
            "School",
        };

      /* ===================================================
         FINAL PARENT MESSAGE
      =================================================== */

      const parentTitle =
        parentTemplate
          ? replacePlaceholders(
              parentTemplate.title,
              notificationData
            )
          : null;

      const parentMessage =
        parentTemplate
          ? replacePlaceholders(
              parentTemplate.message,
              notificationData
            )
          : null;

      /* ===================================================
         FINAL DRIVER MESSAGE
      =================================================== */

      const driverTitle =
        driverTemplate
          ? replacePlaceholders(
              driverTemplate.title,
              notificationData
            )
          : null;

      const driverMessage =
        driverTemplate
          ? replacePlaceholders(
              driverTemplate.message,
              notificationData
            )
          : null;

      /* ===================================================
         SAVE PARENT NOTIFICATIONS
      =================================================== */

      let parentNotifications =
        [];

      if (
        parentTemplate &&
        parents.length
      ) {
        parentNotifications =
          await Promise.all(
            parents.map(
              (
                parent
              ) =>
                Notification.create(
                  {
                    driver:
                      driverId,

                    parent:
                      parent._id,

                    child:
                      childId ||
                      null,

                    recipientType:
                      "parent",

                    notificationKey:
                      normalizedKey,

                    title:
                      parentTitle,

                    message:
                      parentMessage,

                    type:
                      resolvedType,

                    priority,

                    read:
                      false,

                    meta,
                  }
                )
            )
          );
      }

      /* ===================================================
         SAVE DRIVER NOTIFICATION
      =================================================== */

      let driverNotificationRecord =
        null;

      if (
        driverTemplate
      ) {
        driverNotificationRecord =
          await Notification.create(
            {
              driver:
                driverId,

              parent:
                null,

              child:
                childId ||
                null,

              recipientType:
                "driver",

              notificationKey:
                normalizedKey,

              title:
                driverTitle,

              message:
                driverMessage,

              type:
                resolvedType,

              priority,

              read:
                false,

              meta,
            }
          );
      }

      /* ===================================================
         SOCKET — DRIVER
      =================================================== */

      if (
        io &&
        driverNotificationRecord
      ) {
        try {
          io.to(
            String(
              driverId
            )
          ).emit(
            "notification",
            {
              _id:
                driverNotificationRecord
                  ._id,

              title:
                driverTitle,

              message:
                driverMessage,

              notificationKey:
                normalizedKey,

              type:
                resolvedType,

              priority,

              child:
                driverNotificationRecord
                  .child,

              recipientType:
                "driver",

              createdAt:
                driverNotificationRecord
                  .createdAt,
            }
          );
        } catch (error) {
          console.error(
            "Driver socket notification failed:",
            error.message
          );
        }
      }

      /* ===================================================
         SOCKET — PARENT
      =================================================== */

      if (
        io &&
        parentNotifications
          .length
      ) {
        for (
          const notification of
          parentNotifications
        ) {
          try {
            io.to(
              String(
                notification.parent
              )
            ).emit(
              "notification",
              {
                _id:
                  notification._id,

                title:
                  notification.title,

                message:
                  notification.message,

                notificationKey:
                  normalizedKey,

                type:
                  resolvedType,

                priority:
                  notification.priority,

                child:
                  notification.child,

                recipientType:
                  "parent",

                createdAt:
                  notification.createdAt,

                driverId:
                  notification.driver,
              }
            );
          } catch (error) {
            console.error(
              "Parent socket notification failed:",
              error.message
            );
          }
        }
      }

      /* ===================================================
         FCM TOKENS
      =================================================== */

      const parentTokens =
        getValidTokens(
          parents.flatMap(
            (parent) =>
              parent.fcmTokens ||
              []
          )
        );

      const driverTokens =
        getValidTokens(
          driver.fcmTokens ||
            []
        );

      /*
        IMPORTANT:

        Do NOT log actual FCM tokens.
      */

      console.log(
        `Notification ${normalizedKey}: ${parentTokens.length} Parent token(s), ${driverTokens.length} Driver token(s)`
      );

      /* ===================================================
         PARENT FCM
      =================================================== */

      if (
        parentTemplate
      ) {
        await sendParentFCM({
          tokens:
            parentTokens,

          title:
            parentTitle,

          message:
            parentMessage,

          driverId,

          childId,

          notificationKey:
            normalizedKey,

          type:
            resolvedType,

          priority,
        });
      }

      /* ===================================================
         DRIVER FCM
      =================================================== */

      if (
        driverTemplate
      ) {
        await sendDriverFCM({
          driver,

          tokens:
            driverTokens,

          title:
            driverTitle,

          message:
            driverMessage,

          driverId,

          childId,

          notificationKey:
            normalizedKey,

          type:
            resolvedType,

          priority,
        });
      }

      /* ===================================================
         RETURN
      =================================================== */

      return {
        parentNotifications,

        driverNotification:
          driverNotificationRecord,
      };
    } catch (error) {
      console.error(
        "sendNotification failed:",
        error.message
      );

      throw error;
    }
  };
