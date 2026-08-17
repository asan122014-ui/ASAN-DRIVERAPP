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

const isValidObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(
    String(value)
  );

const normalizeDriverId = (
  driverId
) =>
  String(driverId || "")
    .trim()
    .toUpperCase();

/* =========================================================
   DISTANCE CALCULATOR — HAVERSINE
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
        !Number.isFinite(value)
    )
  ) {
    return null;
  }

  const [
    startLat,
    startLon,
    endLat,
    endLon,
  ] = values;

  const R = 6371;

  const dLat =
    ((endLat - startLat) *
      Math.PI) /
    180;

  const dLon =
    ((endLon - startLon) *
      Math.PI) /
    180;

  const a =
    Math.sin(dLat / 2) *
      Math.sin(dLat / 2) +
    Math.cos(
      (startLat * Math.PI) /
        180
    ) *
      Math.cos(
        (endLat * Math.PI) /
          180
      ) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  return (
    R *
    (2 *
      Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1 - a)
      ))
  );
};

/* =========================================================
   TEMPLATE REPLACEMENT
========================================================= */

const replaceTemplateValues = (
  text,
  values = {}
) => {
  let result =
    String(text || "");

  for (
    const [
      key,
      value,
    ] of Object.entries(values)
  ) {
    result = result.replaceAll(
      `{${key}}`,
      String(value ?? "")
    );
  }

  return result;
};

/* =========================================================
   PARENT-ONLY REQUEST NOTIFICATION
========================================================= */

/*
  DRIVER_REQUEST_SUBMITTED is special:

  At this stage no Driver has been assigned yet.

  Therefore we cannot use the normal sendNotification()
  helper because that helper is Driver-linked.

  This helper sends the Parent confirmation directly.
*/

const sendRequestSubmittedNotification =
  async ({
    parent,
    child,
    io,
  }) => {
    try {
      const template =
        PARENT_NOTIFICATIONS
          .DRIVER_REQUEST_SUBMITTED;

      if (!template) {
        console.warn(
          "DRIVER_REQUEST_SUBMITTED Parent notification template missing"
        );

        return;
      }

      const values = {
        childName:
          child?.name || "",

        driverName: "",

        schoolName:
          child?.school || "",
      };

      const title =
        replaceTemplateValues(
          template.title,
          values
        );

      const message =
        replaceTemplateValues(
          template.message,
          values
        );

      /* ===================================================
         SAVE IN DATABASE
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

          notificationKey:
            "DRIVER_REQUEST_SUBMITTED",

          title,

          message,

          type:
            "driver_request_submitted",

          priority:
            "medium",

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
          },
        });

      /* ===================================================
         SOCKET
      =================================================== */

      if (io) {
        io.to(
          String(parent._id)
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
        return;
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

      if (!tokens.length) {
        return;
      }

      const invalidTokens =
        [];

      for (
        let index = 0;
        index <
        tokens.length;
        index += 500
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
                type:
                  "driver_request_submitted",

                notificationKey:
                  "DRIVER_REQUEST_SUBMITTED",

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
    } catch (error) {
      /*
        Notification failure must NOT fail
        Driver Request creation.
      */

      console.error(
        "REQUEST SUBMITTED NOTIFICATION ERROR:",
        error.message
      );
    }
  };

/* =========================================================
   CREATE DRIVER REQUEST
========================================================= */

export const createRequest =
  async (req, res) => {
    try {
      const {
        parentId,
        childId,
        notes,
      } = req.body;

      /* ===================================================
         PARENT ID
      =================================================== */

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
         PARENT
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
         CHILD — OPTIONAL
      =================================================== */

      let child = null;

      if (childId) {
        if (
          !isValidObjectId(
            childId
          )
        ) {
          return res
            .status(400)
            .json({
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
          return res
            .status(404)
            .json({
              success: false,

              message:
                "Child not found for this Parent",
            });
        }
      }

      /* ===================================================
         EXISTING DRIVER
      =================================================== */

      /*
        If the Parent already has a Driver,
        there is normally no reason to create another
        Pending assignment request through this flow.

        Driver-change workflow can be added separately.
      */

      if (
        parent.driverId
      ) {
        return res
          .status(409)
          .json({
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
        return res
          .status(409)
          .json({
            success: false,

            message:
              "A pending Driver request already exists",

            data:
              existingRequest,
          });
      }

      /* ===================================================
         CREATE REQUEST
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
            typeof notes ===
              "string"
              ? notes.trim()
              : "",
        });

      /* ===================================================
         NOTIFICATION
      =================================================== */

      const io =
        req.app.get("io");

      await sendRequestSubmittedNotification(
        {
          parent,
          child,
          io,
        }
      );

      /* ===================================================
         ADMIN SOCKET EVENT
      =================================================== */

      if (io) {
        io.emit(
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

      return res
        .status(201)
        .json({
          success: true,

          message:
            "Driver request submitted successfully",

          data:
            request,
        });
    } catch (error) {
      console.error(
        "CREATE DRIVER REQUEST ERROR:",
        error
      );

      if (
        error.name ===
        "ValidationError"
      ) {
        return res
          .status(400)
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
            "Failed to submit Driver request",
        });
    }
  };

/* =========================================================
   GET ALL REQUESTS WITH NEAREST DRIVERS
========================================================= */

export const getAllRequests =
  async (req, res) => {
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
            createdAt: -1,
          });

      /* ===================================================
         APPROVED DRIVERS
      =================================================== */

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
        /*
          Do NOT delete orphan records during a GET.

          GET endpoints should not silently mutate
          database state.
        */

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
                .filter(Boolean)
                .sort(
                  (a, b) =>
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

      return res
        .status(200)
        .json({
          success: true,

          count:
            data.length,

          data,
        });
    } catch (error) {
      console.error(
        "GET DRIVER REQUESTS ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Failed to fetch Driver requests",
        });
    }
  };

/* =========================================================
   ASSIGN DRIVER
========================================================= */

export const assignDriver =
  async (req, res) => {
    try {
      const {
        driverId,
      } = req.body;

      const {
        id,
      } = req.params;

      /* ===================================================
         REQUEST ID
      =================================================== */

      if (
        !isValidObjectId(id)
      ) {
        return res
          .status(400)
          .json({
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
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Driver ID is required",
          });
      }

      /* ===================================================
         REQUEST
      =================================================== */

      const request =
        await DriverRequest.findById(
          id
        );

      if (!request) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Driver request not found",
          });
      }

      /* ===================================================
         REQUEST STATE
      =================================================== */

      if (
        request.status ===
        "Assigned"
      ) {
        return res
          .status(409)
          .json({
            success: false,

            message:
              "Driver already assigned",

            data:
              request,
          });
      }

      if (
        request.status ===
        "Rejected"
      ) {
        return res
          .status(409)
          .json({
            success: false,

            message:
              "Rejected request cannot be assigned",
          });
      }

      /* ===================================================
         DRIVER
      =================================================== */

      const driver =
        await Driver.findOne({
          driverId:
            normalizedDriverId,
        });

      if (!driver) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Driver not found",
          });
      }

      /* ===================================================
         DRIVER APPROVAL
      =================================================== */

      if (
        String(
          driver.status ||
            ""
        ).toLowerCase() !==
        "approved"
      ) {
        return res
          .status(409)
          .json({
            success: false,

            message:
              "Only an approved Driver can be assigned",
          });
      }

      /* ===================================================
         PARENT
      =================================================== */

      const parent =
        await Parent.findById(
          request.parentId
        );

      if (!parent) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Parent linked to this request no longer exists",
          });
      }

      /* ===================================================
         CHILD VALIDATION
      =================================================== */

      let child = null;

      if (
        request.childId
      ) {
        child =
          await Child.findOne({
            _id:
              request.childId,

            parentId:
              parent._id,
          });

        if (!child) {
          return res
            .status(409)
            .json({
              success: false,

              message:
                "Child linked to this request is invalid",
            });
        }
      }

      /* ===================================================
         UPDATE REQUEST
      =================================================== */

      request.status =
        "Assigned";

      request.assignedDriverId =
        driver.driverId;

      request.assignedAt =
        new Date();

      request.rejectionReason =
        "";

      await request.save();

      /* ===================================================
         UPDATE PARENT
      =================================================== */

      parent.driverId =
        driver.driverId;

      await parent.save();

      /* ===================================================
         UPDATE ALL CHILDREN
      =================================================== */

      /*
        Driver assignment is currently Parent-level.

        Therefore all children under this Parent
        receive the same Driver.
      */

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
        }
      );

      /* ===================================================
         NOTIFICATION
      =================================================== */

      /*
        A Driver exists now, therefore the shared
        sendNotification() helper can be safely used.
      */

      try {
        await sendNotification({
          driverId:
            driver.driverId,

          childId:
            child?._id ||
            null,

          notificationKey:
            "DRIVER_REQUEST_ACCEPTED",

          io:
            req.app.get(
              "io"
            ),
        });
      } catch (
        notificationError
      ) {
        /*
          Assignment is already committed.

          Notification failure must not turn a successful
          assignment into a failed API response.
        */

        console.error(
          "DRIVER ASSIGNMENT NOTIFICATION ERROR:",
          notificationError.message
        );
      }

      /* ===================================================
         SOCKET EVENT
      =================================================== */

      const io =
        req.app.get("io");

      if (io) {
        io.emit(
          "driver_request_assigned",
          {
            requestId:
              String(
                request._id
              ),

            parentId:
              String(
                parent._id
              ),

            driverId:
              driver.driverId,
          }
        );
      }

      /* ===================================================
         POPULATED RESPONSE
      =================================================== */

      const updatedRequest =
        await DriverRequest.findById(
          request._id
        )
          .populate(
            "parentId",
            "name email phone address driverId"
          )
          .populate(
            "childId",
            "name school grade driverId"
          );

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Driver assigned successfully",

          data:
            updatedRequest,
        });
    } catch (error) {
      console.error(
        "ASSIGN DRIVER ERROR:",
        error
      );

      if (
        error.name ===
        "ValidationError"
      ) {
        return res
          .status(400)
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
            "Failed to assign Driver",
        });
    }
  };
/* =========================================================
   REJECT DRIVER REQUEST
========================================================= */

export const rejectDriverRequest =
  async (req, res) => {
    try {
      const {
        id,
      } = req.params;

      const {
        rejectionReason,
      } = req.body;

      /* ===================================================
         REQUEST ID
      =================================================== */

      if (
        !isValidObjectId(id)
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Invalid Driver Request ID",
          });
      }

      /* ===================================================
         REJECTION REASON
      =================================================== */

      const reason =
        String(
          rejectionReason ||
            ""
        ).trim();

      if (!reason) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Rejection reason is required",
          });
      }

      /* ===================================================
         FIND REQUEST
      =================================================== */

      const request =
        await DriverRequest.findById(
          id
        );

      if (!request) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Driver request not found",
          });
      }

      /* ===================================================
         STATE VALIDATION
      =================================================== */

      if (
        request.status ===
        "Assigned"
      ) {
        return res
          .status(409)
          .json({
            success: false,

            message:
              "Assigned request cannot be rejected",
          });
      }

      if (
        request.status ===
        "Rejected"
      ) {
        return res
          .status(200)
          .json({
            success: true,

            message:
              "Driver request is already rejected",

            data:
              request,
          });
      }

      /* ===================================================
         PARENT
      =================================================== */

      const parent =
        await Parent.findById(
          request.parentId
        );

      if (!parent) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Parent linked to this request no longer exists",
          });
      }

      /* ===================================================
         CHILD
      =================================================== */

      let child = null;

      if (
        request.childId
      ) {
        child =
          await Child.findById(
            request.childId
          );
      }

      /* ===================================================
         UPDATE REQUEST
      =================================================== */

      request.status =
        "Rejected";

      request.rejectionReason =
        reason;

      request.assignedDriverId =
        "";

      request.assignedAt =
        null;

      await request.save();

      /* ===================================================
         PARENT NOTIFICATION
      =================================================== */

      try {
        const template =
          PARENT_NOTIFICATIONS
            .DRIVER_REQUEST_SUBMITTED;

        /*
          We do not yet have a dedicated
          DRIVER_REQUEST_REJECTED template.

          So create a direct notification.
        */

        const notification =
          await Notification.create({
            parent:
              parent._id,

            child:
              child?._id ||
              null,

            recipientType:
              "parent",

            notificationKey:
              "DRIVER_REQUEST_REJECTED",

            title:
              "Driver Request Rejected",

            message:
              `Your Driver request was rejected. Reason: ${reason}`,

            type:
              "driver_request_rejected",

            priority:
              "medium",

            meta: {
              requestId:
                String(
                  request._id
                ),

              rejectionReason:
                reason,
            },
          });

        const io =
          req.app.get("io");

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

        if (
          parentMessaging
        ) {
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
            tokens.length
          ) {
            for (
              let index = 0;
              index <
              tokens.length;
              index += 500
            ) {
              const chunk =
                tokens.slice(
                  index,
                  index + 500
                );

              await parentMessaging.sendEachForMulticast(
                {
                  tokens:
                    chunk,

                  notification: {
                    title:
                      "Driver Request Rejected",

                    body:
                      `Your Driver request was rejected. Reason: ${reason}`,
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
                      "driver_request_rejected",

                    notificationKey:
                      "DRIVER_REQUEST_REJECTED",

                    requestId:
                      String(
                        request._id
                      ),
                  },
                }
              );
            }
          }
        }
      } catch (
        notificationError
      ) {
        console.error(
          "DRIVER REQUEST REJECTION NOTIFICATION ERROR:",
          notificationError.message
        );
      }

      /* ===================================================
         SOCKET EVENT
      =================================================== */

      const io =
        req.app.get("io");

      if (io) {
        io.emit(
          "driver_request_rejected",
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

      /* ===================================================
         RESPONSE
      =================================================== */

      const updatedRequest =
        await DriverRequest.findById(
          request._id
        )
          .populate(
            "parentId",
            "name email phone address"
          )
          .populate(
            "childId",
            "name school grade"
          );

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Driver request rejected successfully",

          data:
            updatedRequest,
        });
    } catch (error) {
      console.error(
        "REJECT DRIVER REQUEST ERROR:",
        error
      );

      if (
        error.name ===
        "ValidationError"
      ) {
        return res
          .status(400)
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
            "Failed to reject Driver request",
        });
    }
  };
