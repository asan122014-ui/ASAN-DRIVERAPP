import mongoose from "mongoose";

import DriverRequest from "../models/DriverRequest.js";
import Parent from "../models/Parent.js";
import Child from "../models/Child.js";
import Driver from "../models/Driver.js";
import Notification from "../models/Notification.js";

import {
  sendNotification,
} from "../utils/sendNotification.js";

import {
  PARENT_NOTIFICATIONS,
} from "../utils/notificationMessages.js";

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

const isValidObjectId = (
  value
) =>
  mongoose.Types.ObjectId.isValid(
    String(
      value || ""
    )
  );

const normalizeDriverId = (
  driverId
) =>
  String(
    driverId || ""
  )
    .trim()
    .toUpperCase();

/* =========================================================
   HTTP ERROR
========================================================= */

const createHttpError = (
  statusCode,
  message,
  data = undefined
) => {
  const error =
    new Error(message);

  error.statusCode =
    statusCode;

  if (
    data !==
    undefined
  ) {
    error.data =
      data;
  }

  return error;
};

/* =========================================================
   ERROR RESPONSE
========================================================= */

const handleControllerError = (
  error,
  res,
  fallbackMessage
) => {
  if (
    error?.statusCode
  ) {
    return res
      .status(
        error.statusCode
      )
      .json({
        success: false,

        message:
          error.message,

        ...(error.data !==
        undefined
          ? {
              data:
                error.data,
            }
          : {}),
      });
  }

  if (
    error?.name ===
    "ValidationError"
  ) {
    return res.status(400).json({
      success: false,
      message:
        error.message,
    });
  }

  console.error(
    fallbackMessage,
    error
  );

  return res.status(500).json({
    success: false,
    message:
      fallbackMessage,
  });
};

/* =========================================================
   DISTANCE CALCULATOR
========================================================= */

const getDistance = (
  lat1,
  lon1,
  lat2,
  lon2
) => {
  const values = [
    lat1,
    lon1,
    lat2,
    lon2,
  ].map(Number);

  if (
    values.some(
      (value) =>
        !Number.isFinite(
          value
        )
    )
  ) {
    return null;
  }

  const [
    startLat,
    startLon,
    endLat,
    endLon,
  ] =
    values;

  if (
    startLat < -90 ||
    startLat > 90 ||
    endLat < -90 ||
    endLat > 90 ||
    startLon < -180 ||
    startLon > 180 ||
    endLon < -180 ||
    endLon > 180
  ) {
    return null;
  }

  const R =
    6371;

  const dLat =
    ((endLat -
      startLat) *
      Math.PI) /
    180;

  const dLon =
    ((endLon -
      startLon) *
      Math.PI) /
    180;

  const a =
    Math.sin(
      dLat / 2
    ) *
      Math.sin(
        dLat / 2
      ) +
    Math.cos(
      (startLat *
        Math.PI) /
        180
    ) *
      Math.cos(
        (endLat *
          Math.PI) /
          180
      ) *
      Math.sin(
        dLon / 2
      ) *
      Math.sin(
        dLon / 2
      );

  return (
    R *
    (2 *
      Math.atan2(
        Math.sqrt(a),
        Math.sqrt(
          1 - a
        )
      ))
  );
};

/* =========================================================
   TEMPLATE VALUES
========================================================= */

const replaceTemplateValues = (
  text,
  values = {}
) => {
  let result =
    String(
      text || ""
    );

  for (
    const [
      key,
      value,
    ] of Object.entries(
      values
    )
  ) {
    result =
      result.replaceAll(
        `{${key}}`,
        String(
          value ?? ""
        )
      );
  }

  return result;
};

/* =========================================================
   SEND PARENT-ONLY DRIVER REQUEST NOTIFICATION
========================================================= */

const sendParentRequestNotification =
  async ({
    parent,
    child,
    notificationKey,
    type,
    priority = "medium",
    values = {},
    fallbackTitle,
    fallbackMessage,
    meta = {},
    io,
  }) => {
    try {
      const template =
        PARENT_NOTIFICATIONS?.[
          notificationKey
        ];

      const templateValues = {
        childName:
          child?.name ||
          "",

        schoolName:
          child?.school ||
          "",

        driverName:
          "",

        ...values,
      };

      const title =
        template?.title
          ? replaceTemplateValues(
              template.title,
              templateValues
            )
          : fallbackTitle;

      const message =
        template?.message
          ? replaceTemplateValues(
              template.message,
              templateValues
            )
          : fallbackMessage;

      /* ===================================================
         DATABASE
      =================================================== */

      const notification =
        await Notification.create({
          parent:
            parent._id,

          child:
            child?._id ||
            null,

          recipientType:
            "parent",

          notificationKey,

          title,

          message,

          type,

          priority,

          meta: {
            parentId:
              String(
                parent._id
              ),

            childId:
              child
                ? String(
                    child._id
                  )
                : "",

            ...meta,
          },
        });

      /* ===================================================
         SOCKET
      =================================================== */

      if (io) {
        io.to(
          String(
            parent._id
          )
        ).emit(
          "notification",
          notification
        );
      }

      /* ===================================================
         FCM
      =================================================== */

      if (
        !parentMessaging
      ) {
        return notification;
      }

      const tokens = [
        ...new Set(
          (
            parent.fcmTokens ||
            []
          )
            .filter(
              (token) =>
                typeof token ===
                  "string" &&
                token.trim()
            )
            .map(
              (token) =>
                token.trim()
            )
        ),
      ];

      if (
        tokens.length ===
        0
      ) {
        return notification;
      }

      const invalidTokens =
        [];

      for (
        let index = 0;
        index <
        tokens.length;
        index +=
        500
      ) {
        const chunk =
          tokens.slice(
            index,
            index + 500
          );

        const response =
          await parentMessaging.sendEachForMulticast(
            {
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

              data: {
                type,

                notificationKey,

                parentId:
                  String(
                    parent._id
                  ),

                childId:
                  child
                    ? String(
                        child._id
                      )
                    : "",
              },
            }
          );

        response.responses.forEach(
          (
            item,
            itemIndex
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
                  itemIndex
                ]
              );
            }
          }
        );
      }

      /* ===================================================
         INVALID TOKEN CLEANUP
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

      return notification;
    } catch (error) {
      /*
        Notification delivery must never
        roll back the Driver Request action.
      */

      console.error(
        `${notificationKey} NOTIFICATION ERROR:`,
        error.message
      );

      return null;
    }
  };

/* =========================================================
   CREATE DRIVER REQUEST
   AUTHENTICATED PARENT ONLY
========================================================= */

export const createRequest =
  async (
    req,
    res
  ) => {
    try {
      const parent =
        req.parent;

      if (!parent) {
        return res.status(401).json({
          success: false,
          message:
            "Parent authentication required",
        });
      }

      const {
        parentId,
        childId,
        notes,
      } =
        req.body || {};

      /* ===================================================
         OPTIONAL LEGACY PARENT ID
      =================================================== */

      /*
        Existing frontend may still send parentId.

        It is not trusted.

        If supplied, it must match the Parent identified
        by the Firebase token.
      */

      if (
        parentId &&
        String(
          parentId
        ) !==
          String(
            parent._id
          )
      ) {
        return res.status(403).json({
          success: false,

          message:
            "You cannot create a Driver request for another Parent",
        });
      }

      /* ===================================================
         CHILD
      =================================================== */

      let child =
        null;

      if (childId) {
        if (
          !isValidObjectId(
            childId
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid Child ID",
          });
        }

        child =
          await Child.findOne({
            _id:
              childId,

            parentId:
              parent._id,
          });

        if (!child) {
          return res.status(404).json({
            success: false,

            message:
              "Child not found for this Parent",
          });
        }
      }

      /* ===================================================
         NOTES
      =================================================== */

      const normalizedNotes =
        typeof notes ===
        "string"
          ? notes.trim()
          : "";

      if (
        normalizedNotes.length >
        1000
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Notes must not exceed 1000 characters",
        });
      }

      /* ===================================================
         ALREADY HAS DRIVER
      =================================================== */

      if (
        parent.driverId
      ) {
        return res.status(409).json({
          success: false,

          message:
            "A Driver is already linked to this Parent",
        });
      }

      /* ===================================================
         DUPLICATE PENDING REQUEST
      =================================================== */

      const existingRequest =
        await DriverRequest.findOne({
          parentId:
            parent._id,

          status:
            "Pending",
        });

      if (
        existingRequest
      ) {
        return res.status(409).json({
          success: false,

          message:
            "A pending Driver request already exists",

          data:
            existingRequest,
        });
      }

      /* ===================================================
         CREATE
      =================================================== */

      const request =
        await DriverRequest.create({
          parentId:
            parent._id,

          childId:
            child?._id ||
            null,

          status:
            "Pending",

          notes:
            normalizedNotes,
        });

      const io =
        req.app.get(
          "io"
        );

      /* ===================================================
         PARENT CONFIRMATION
      =================================================== */

      await sendParentRequestNotification({
        parent,
        child,

        notificationKey:
          "DRIVER_REQUEST_SUBMITTED",

        type:
          "driver_request_submitted",

        priority:
          "medium",

        fallbackTitle:
          "Driver Request Submitted",

        fallbackMessage:
          "Your Driver request has been submitted successfully.",

        meta: {
          requestId:
            String(
              request._id
            ),
        },

        io,
      });

      /* ===================================================
         ADMIN SOCKET EVENT
      =================================================== */

      /*
        Do not broadcast this event to every Socket.IO user.

        Admin socket authentication/room joining will be
        finalized during the Socket.IO security pass.
      */

      if (io) {
        io.to(
          "admin"
        ).emit(
          "driver_request_created",
          {
            requestId:
              String(
                request._id
              ),

            parentId:
              String(
                parent._id
              ),
          }
        );
      }

      return res.status(201).json({
        success: true,

        message:
          "Driver request submitted successfully",

        data:
          request,
      });
    } catch (error) {
      return handleControllerError(
        error,
        res,
        "Failed to submit Driver request"
      );
    }
  };

/* =========================================================
   GET ALL DRIVER REQUESTS
   ADMIN ONLY
========================================================= */

export const getAllRequests =
  async (
    req,
    res
  ) => {
    try {
      const requests =
        await DriverRequest.find()
          .populate(
            "parentId",
            "name email phone address homeLocation driverId"
          )
          .populate(
            "childId",
            "name school grade"
          )
          .sort({
            createdAt:
              -1,
          });

      const approvedDrivers =
        await Driver.find({
          status:
            "approved",
        }).select(
          "name driverId phone vehicleNumber address homeLocation status"
        );

      const data =
        [];

      for (
        const request of
        requests
      ) {
        /* =================================================
           ORPHAN REQUEST
        ================================================= */

        if (
          !request.parentId
        ) {
          data.push({
            ...request.toObject(),

            orphaned:
              true,

            nearestDrivers:
              [],
          });

          continue;
        }

        const parent =
          request.parentId;

        let nearestDrivers =
          [];

        const parentCoordinates =
          parent
            .homeLocation
            ?.coordinates;

        if (
          Array.isArray(
            parentCoordinates
          ) &&
          parentCoordinates.length ===
            2
        ) {
          const parentLng =
            Number(
              parentCoordinates[
                0
              ]
            );

          const parentLat =
            Number(
              parentCoordinates[
                1
              ]
            );

          if (
            Number.isFinite(
              parentLng
            ) &&
            Number.isFinite(
              parentLat
            )
          ) {
            nearestDrivers =
              approvedDrivers
                .map(
                  (
                    driver
                  ) => {
                    const coordinates =
                      driver
                        .homeLocation
                        ?.coordinates;

                    if (
                      !Array.isArray(
                        coordinates
                      ) ||
                      coordinates.length !==
                        2
                    ) {
                      return null;
                    }

                    const driverLng =
                      Number(
                        coordinates[
                          0
                        ]
                      );

                    const driverLat =
                      Number(
                        coordinates[
                          1
                        ]
                      );

                    const distance =
                      getDistance(
                        parentLat,
                        parentLng,
                        driverLat,
                        driverLng
                      );

                    if (
                      distance ===
                      null
                    ) {
                      return null;
                    }

                    return {
                      _id:
                        driver._id,

                      name:
                        driver.name,

                      driverId:
                        driver.driverId,

                      phone:
                        driver.phone,

                      vehicleNumber:
                        driver.vehicleNumber,

                      address:
                        driver.address,

                      distance:
                        Number(
                          distance.toFixed(
                            2
                          )
                        ),
                    };
                  }
                )
                .filter(
                  Boolean
                )
                .sort(
                  (
                    a,
                    b
                  ) =>
                    a.distance -
                    b.distance
                )
                .slice(
                  0,
                  5
                );
          }
        }

        data.push({
          ...request.toObject(),

          orphaned:
            false,

          nearestDrivers,
        });
      }

      return res.status(200).json({
        success: true,

        count:
          data.length,

        data,
      });
    } catch (error) {
      return handleControllerError(
        error,
        res,
        "Failed to fetch Driver requests"
      );
    }
  };

/* =========================================================
   ASSIGN DRIVER
   ADMIN ONLY
========================================================= */

export const assignDriver =
  async (
    req,
    res
  ) => {
    const session =
      await mongoose.startSession();

    let assignedRequest =
      null;

    let assignedDriver =
      null;

    let assignedParent =
      null;

    let assignedChild =
      null;

    try {
      const {
        id,
      } =
        req.params;

      const {
        driverId,
      } =
        req.body || {};

      /* ===================================================
         REQUEST ID
      =================================================== */

      if (
        !isValidObjectId(
          id
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid Driver Request ID",
        });
      }

      /* ===================================================
         DRIVER ID
      =================================================== */

      const normalizedDriverId =
        normalizeDriverId(
          driverId
        );

      if (
        !normalizedDriverId
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Driver ID is required",
        });
      }

      /* ===================================================
         TRANSACTION
      =================================================== */

      await session.withTransaction(
        async () => {
          /* ===============================================
             REQUEST
          =============================================== */

          const request =
            await DriverRequest.findById(
              id
            ).session(
              session
            );

          if (!request) {
            throw createHttpError(
              404,
              "Driver request not found"
            );
          }

          if (
            request.status ===
            "Assigned"
          ) {
            throw createHttpError(
              409,
              "Driver already assigned",
              request
            );
          }

          if (
            request.status ===
            "Rejected"
          ) {
            throw createHttpError(
              409,
              "Rejected request cannot be assigned"
            );
          }

          if (
            request.status !==
            "Pending"
          ) {
            throw createHttpError(
              409,
              "Driver request is not pending"
            );
          }

          /* ===============================================
             DRIVER
          =============================================== */

          const driver =
            await Driver.findOne({
              driverId:
                normalizedDriverId,
            }).session(
              session
            );

          if (!driver) {
            throw createHttpError(
              404,
              "Driver not found"
            );
          }

          if (
            driver.status !==
            "approved"
          ) {
            throw createHttpError(
              409,
              "Only an approved Driver can be assigned"
            );
          }

          /* ===============================================
             PARENT
          =============================================== */

          const parent =
            await Parent.findById(
              request.parentId
            ).session(
              session
            );

          if (!parent) {
            throw createHttpError(
              404,
              "Parent linked to this request no longer exists"
            );
          }

          /*
            Prevent a stale request from overwriting
            a Driver that may have been linked elsewhere
            after this request was created.
          */

          if (
            parent.driverId &&
            normalizeDriverId(
              parent.driverId
            ) !==
              driver.driverId
          ) {
            throw createHttpError(
              409,
              "Parent already has another Driver linked"
            );
          }

          /* ===============================================
             CHILD
          =============================================== */

          let child =
            null;

          if (
            request.childId
          ) {
            child =
              await Child.findOne({
                _id:
                  request.childId,

                parentId:
                  parent._id,
              }).session(
                session
              );

            if (!child) {
              throw createHttpError(
                409,
                "Child linked to this request is invalid"
              );
            }
          }

          /* ===============================================
             REQUEST UPDATE
          =============================================== */

          request.status =
            "Assigned";

          request.assignedDriverId =
            driver.driverId;

          request.assignedAt =
            new Date();

          request.rejectionReason =
            "";

          await request.save({
            session,
          });

          /* ===============================================
             PARENT UPDATE
          =============================================== */

          parent.driverId =
            driver.driverId;

          await parent.save({
            session,
          });

          /* ===============================================
             CHILDREN UPDATE
          =============================================== */

          await Child.updateMany(
            {
              parentId:
                parent._id,
            },

            {
              $set: {
                driverId:
                  driver.driverId,
              },
            },

            {
              session,
            }
          );

          assignedRequest =
            request;

          assignedDriver =
            driver;

          assignedParent =
            parent;

          assignedChild =
            child;
        }
      );

      /* ===================================================
         NOTIFICATION AFTER COMMIT
      =================================================== */

      try {
        await sendNotification({
          driverId:
            assignedDriver.driverId,

          childId:
            assignedChild?._id ||
            null,

          notificationKey:
            "DRIVER_REQUEST_ACCEPTED",

          io:
            req.app.get(
              "io"
            ),
        });
      } catch (error) {
        console.error(
          "DRIVER ASSIGNMENT NOTIFICATION ERROR:",
          error.message
        );
      }

      /* ===================================================
         SOCKET EVENTS
      =================================================== */

      const io =
        req.app.get(
          "io"
        );

      if (io) {
        const payload = {
          requestId:
            String(
              assignedRequest._id
            ),

          parentId:
            String(
              assignedParent._id
            ),

          driverId:
            assignedDriver.driverId,
        };

        io.to(
          String(
            assignedParent._id
          )
        ).emit(
          "driver_request_assigned",
          payload
        );

        io.to(
          String(
            assignedDriver.driverId
          )
        ).emit(
          "driver_request_assigned",
          payload
        );

        io.to(
          "admin"
        ).emit(
          "driver_request_assigned",
          payload
        );
      }

      /* ===================================================
         RESPONSE
      =================================================== */

      const updatedRequest =
        await DriverRequest.findById(
          assignedRequest._id
        )
          .populate(
            "parentId",
            "name email phone address driverId"
          )
          .populate(
            "childId",
            "name school grade driverId"
          );

      return res.status(200).json({
        success: true,

        message:
          "Driver assigned successfully",

        data:
          updatedRequest,
      });
    } catch (error) {
      return handleControllerError(
        error,
        res,
        "Failed to assign Driver"
      );
    } finally {
      await session.endSession();
    }
  };

/* =========================================================
   REJECT DRIVER REQUEST
   ADMIN ONLY
========================================================= */

export const rejectDriverRequest =
  async (
    req,
    res
  ) => {
    const session =
      await mongoose.startSession();

    let rejectedRequest =
      null;

    let rejectedParent =
      null;

    let rejectedChild =
      null;

    try {
      const {
        id,
      } =
        req.params;

      const {
        rejectionReason,
      } =
        req.body || {};

      /* ===================================================
         REQUEST ID
      =================================================== */

      if (
        !isValidObjectId(
          id
        )
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Invalid Driver Request ID",
        });
      }

      /* ===================================================
         REASON
      =================================================== */

      const reason =
        String(
          rejectionReason ||
            ""
        ).trim();

      if (!reason) {
        return res.status(400).json({
          success: false,

          message:
            "Rejection reason is required",
        });
      }

      if (
        reason.length >
        500
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Rejection reason must not exceed 500 characters",
        });
      }

      /* ===================================================
         TRANSACTION
      =================================================== */

      await session.withTransaction(
        async () => {
          const request =
            await DriverRequest.findById(
              id
            ).session(
              session
            );

          if (!request) {
            throw createHttpError(
              404,
              "Driver request not found"
            );
          }

          if (
            request.status ===
            "Assigned"
          ) {
            throw createHttpError(
              409,
              "Assigned request cannot be rejected"
            );
          }

          if (
            request.status ===
            "Rejected"
          ) {
            throw createHttpError(
              409,
              "Driver request is already rejected",
              request
            );
          }

          if (
            request.status !==
            "Pending"
          ) {
            throw createHttpError(
              409,
              "Driver request is not pending"
            );
          }

          const parent =
            await Parent.findById(
              request.parentId
            ).session(
              session
            );

          if (!parent) {
            throw createHttpError(
              404,
              "Parent linked to this request no longer exists"
            );
          }

          let child =
            null;

          if (
            request.childId
          ) {
            child =
              await Child.findOne({
                _id:
                  request.childId,

                parentId:
                  parent._id,
              }).session(
                session
              );
          }

          request.status =
            "Rejected";

          request.rejectionReason =
            reason;

          request.assignedDriverId =
            "";

          request.assignedAt =
            null;

          await request.save({
            session,
          });

          rejectedRequest =
            request;

          rejectedParent =
            parent;

          rejectedChild =
            child;
        }
      );

      /* ===================================================
         PARENT NOTIFICATION
      =================================================== */

      const io =
        req.app.get(
          "io"
        );

      await sendParentRequestNotification({
        parent:
          rejectedParent,

        child:
          rejectedChild,

        notificationKey:
          "DRIVER_REQUEST_REJECTED",

        type:
          "driver_request_rejected",

        priority:
          "medium",

        values: {
          reason,

          rejectionReason:
            reason,
        },

        fallbackTitle:
          "Driver Request Rejected",

        fallbackMessage:
          `Your Driver request was rejected. Reason: ${reason}`,

        meta: {
          requestId:
            String(
              rejectedRequest._id
            ),

          rejectionReason:
            reason,
        },

        io,
      });

      /* ===================================================
         SOCKET EVENTS
      =================================================== */

      if (io) {
        const payload = {
          requestId:
            String(
              rejectedRequest._id
            ),

          parentId:
            String(
              rejectedParent._id
            ),

          reason,
        };

        io.to(
          String(
            rejectedParent._id
          )
        ).emit(
          "driver_request_rejected",
          payload
        );

        io.to(
          "admin"
        ).emit(
          "driver_request_rejected",
          payload
        );
      }

      /* ===================================================
         RESPONSE
      =================================================== */

      const updatedRequest =
        await DriverRequest.findById(
          rejectedRequest._id
        )
          .populate(
            "parentId",
            "name email phone address"
          )
          .populate(
            "childId",
            "name school grade"
          );

      return res.status(200).json({
        success: true,

        message:
          "Driver request rejected successfully",

        data:
          updatedRequest,
      });
    } catch (error) {
      return handleControllerError(
        error,
        res,
        "Failed to reject Driver request"
      );
    } finally {
      await session.endSession();
    }
  };
