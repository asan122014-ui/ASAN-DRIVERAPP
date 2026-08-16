import express from "express";
import axios from "axios";

import Child from "../models/Child.js";
import Parent from "../models/Parent.js";
import Trips from "../models/Trips.js";

import {
  sendNotification,
} from "../utils/sendNotification.js";

const router = express.Router();

/* =========================================================
   HELPERS
========================================================= */

/* =========================================================
   SAFE NOTIFICATION
========================================================= */

const safeNotify = async (
  req,
  payload
) => {
  try {
    const io =
      req.app.get("io");

    if (!io) {
      console.warn(
        "⚠️ Socket.IO not available for notification"
      );

      return;
    }

    await sendNotification({
      ...payload,
      io,
    });

    console.log(
      "✅ Child notification sent"
    );
  } catch (error) {
    /*
      Notification failure must NOT fail
      pickup/drop/absence operations.
    */

    console.error(
      "⚠️ Notification failed:",
      error.message
    );
  }
};

/* =========================================================
   OBJECT ID ERROR
========================================================= */

const handleCastError = (
  error,
  res
) => {
  if (
    error?.name ===
    "CastError"
  ) {
    res.status(400).json({
      success: false,
      message:
        "Invalid ID",
    });

    return true;
  }

  return false;
};

/* =========================================================
   NORMALIZE DRIVER ID
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
   VALIDATE COORDINATES
========================================================= */

const normalizeCoordinates = (
  value,
  name
) => {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    )
  ) {
    throw new Error(
      `${name} must be a valid number`
    );
  }

  return number;
};

/* =========================================================
   GET COORDINATE PAIR
========================================================= */

const getCoordinatePair = (
  source,
  label
) => {
  if (!source) {
    return {
      lat: null,
      lng: null,
    };
  }

  const lat =
    normalizeCoordinates(
      source.lat,
      `${label} latitude`
    );

  const lng =
    normalizeCoordinates(
      source.lng,
      `${label} longitude`
    );

  const hasLat =
    lat !== null;

  const hasLng =
    lng !== null;

  if (
    hasLat !== hasLng
  ) {
    throw new Error(
      `${label} latitude and longitude must be provided together`
    );
  }

  if (
    lat !== null &&
    (lat < -90 ||
      lat > 90)
  ) {
    throw new Error(
      `${label} latitude must be between -90 and 90`
    );
  }

  if (
    lng !== null &&
    (lng < -180 ||
      lng > 180)
  ) {
    throw new Error(
      `${label} longitude must be between -180 and 180`
    );
  }

  return {
    lat,
    lng,
  };
};

/* =========================================================
   CALCULATE ROUTE DETAILS
========================================================= */

const calculateRouteDetails =
  async (
    pickup,
    drop
  ) => {
    let routeDistance = 0;
    let estimatedDuration = 0;

    /*
      Both locations must exist.
    */

    if (
      pickup.lat === null ||
      pickup.lng === null ||
      drop.lat === null ||
      drop.lng === null
    ) {
      return {
        routeDistance,
        estimatedDuration,
      };
    }

    /*
      If Google Maps API is not configured,
      Child creation/update should still work.
    */

    if (
      !process.env
        .GOOGLE_MAPS_API_KEY
    ) {
      console.warn(
        "⚠️ GOOGLE_MAPS_API_KEY missing. Route distance skipped."
      );

      return {
        routeDistance,
        estimatedDuration,
      };
    }

    try {
      const response =
        await axios.get(
          "https://maps.googleapis.com/maps/api/distancematrix/json",
          {
            params: {
              origins:
                `${pickup.lat},${pickup.lng}`,

              destinations:
                `${drop.lat},${drop.lng}`,

              key:
                process.env
                  .GOOGLE_MAPS_API_KEY,
            },

            timeout: 8000,
          }
        );

      const element =
        response.data
          ?.rows?.[0]
          ?.elements?.[0];

      if (
        element?.status !==
        "OK"
      ) {
        console.warn(
          "⚠️ Google Distance Matrix status:",
          element?.status ||
            response.data?.status
        );

        return {
          routeDistance,
          estimatedDuration,
        };
      }

      if (
        element.distance
          ?.value !==
        undefined
      ) {
        routeDistance =
          Number(
            (
              element.distance
                .value /
              1000
            ).toFixed(2)
          );
      }

      if (
        element.duration
          ?.value !==
        undefined
      ) {
        estimatedDuration =
          Math.ceil(
            element.duration
              .value /
              60
          );
      }

      return {
        routeDistance,
        estimatedDuration,
      };
    } catch (error) {
      console.error(
        "❌ Google Distance API Error:",
        error.response?.data ||
          error.message
      );

      /*
        Do not fail Child creation
        because Google's API failed.
      */

      return {
        routeDistance,
        estimatedDuration,
      };
    }
  };

/* =========================================================
   ADD CHILD
========================================================= */

router.post(
  "/add",
  async (req, res) => {
    try {
      const {
        name,
        age,
        school,
        grade,

        pickupTime,
        dropoffTime,

        eveningPickup,
        eveningDrop,

        pickupLocation,
        dropoffLocation,

        location,
        dropLocationCoords,

        parentId,
        driverId,
      } = req.body;

      /* ===================================================
         REQUIRED FIELDS
      =================================================== */

      if (
        !name?.trim() ||
        !parentId
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Name and parentId are required",
          });
      }

      /* ===================================================
         VERIFY PARENT
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
         AGE
      =================================================== */

      let normalizedAge =
        null;

      if (
        age !== undefined &&
        age !== null &&
        age !== ""
      ) {
        normalizedAge =
          Number(age);

        if (
          !Number.isInteger(
            normalizedAge
          ) ||
          normalizedAge < 1 ||
          normalizedAge > 25
        ) {
          return res
            .status(400)
            .json({
              success: false,

              message:
                "Age must be between 1 and 25",
            });
        }
      }

      /* ===================================================
         COORDINATES
      =================================================== */

      let pickup;
      let drop;

      try {
        pickup =
          getCoordinatePair(
            location,
            "Pickup"
          );

        drop =
          getCoordinatePair(
            dropLocationCoords,
            "Drop"
          );
      } catch (error) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              error.message,
          });
      }

      /* ===================================================
         DRIVER
      =================================================== */

      /*
        If frontend does not send driverId,
        automatically inherit the Parent's
        currently linked Driver.
      */

      const normalizedDriverId =
        normalizeDriverId(
          driverId ||
            parent.driverId ||
            ""
        );

      /* ===================================================
         ROUTE DISTANCE
      =================================================== */

      const {
        routeDistance,
        estimatedDuration,
      } =
        await calculateRouteDetails(
          pickup,
          drop
        );

      /* ===================================================
         CREATE CHILD
      =================================================== */

      const child =
        await Child.create({
          name:
            name.trim(),

          age:
            normalizedAge,

          school:
            school
              ? String(
                  school
                ).trim()
              : "",

          grade:
            grade
              ? String(
                  grade
                ).trim()
              : "",

          pickupTime:
            pickupTime
              ? String(
                  pickupTime
                ).trim()
              : "",

          dropoffTime:
            dropoffTime
              ? String(
                  dropoffTime
                ).trim()
              : "",

          eveningPickup:
            eveningPickup
              ? String(
                  eveningPickup
                ).trim()
              : "",

          eveningDrop:
            eveningDrop
              ? String(
                  eveningDrop
                ).trim()
              : "",

          pickupLocation:
            pickupLocation
              ? String(
                  pickupLocation
                ).trim()
              : "",

          dropoffLocation:
            dropoffLocation
              ? String(
                  dropoffLocation
                ).trim()
              : "",

          location: {
            lat:
              pickup.lat,

            lng:
              pickup.lng,
          },

          dropLocationCoords:
            {
              lat:
                drop.lat,

              lng:
                drop.lng,
            },

          parentId,

          driverId:
            normalizedDriverId,

          routeDistance,

          estimatedDuration,

          status:
            "waiting",
        });

      return res
        .status(201)
        .json({
          success: true,

          message:
            "Child added successfully",

          data: child,
        });
    } catch (error) {
      console.error(
        "🔥 ADD CHILD ERROR:",
        error
      );

      if (
        handleCastError(
          error,
          res
        )
      ) {
        return;
      }

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
            "Failed to add child",
        });
    }
  }
);

/* =========================================================
   GET CHILD BY ID
========================================================= */

router.get(
  "/single/:id",
  async (req, res) => {
    try {
      const child =
        await Child.findById(
          req.params.id
        );

      if (!child) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Child not found",
          });
      }

      return res
        .status(200)
        .json({
          success: true,
          data: child,
        });
    } catch (error) {
      console.error(
        "❌ GET CHILD ERROR:",
        error
      );

      if (
        handleCastError(
          error,
          res
        )
      ) {
        return;
      }

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Failed to fetch child",
        });
    }
  }
);

/* =========================================================
   GET CHILDREN BY PARENT
========================================================= */

router.get(
  "/parent/:parentId",
  async (req, res) => {
    try {
      const {
        parentId,
      } = req.params;

      /* ===================================================
         VERIFY PARENT
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

      const children =
        await Child.find({
          parentId,
        }).sort({
          createdAt: 1,
        });

      return res
        .status(200)
        .json({
          success: true,
          data: children,
        });
    } catch (error) {
      console.error(
        "❌ PARENT CHILDREN FETCH ERROR:",
        error
      );

      if (
        handleCastError(
          error,
          res
        )
      ) {
        return;
      }

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Failed to fetch children",
        });
    }
  }
);

/* =========================================================
   GET CHILDREN BY DRIVER
========================================================= */

router.get(
  "/driver/:driverId",
  async (req, res) => {
    try {
      const driverId =
        normalizeDriverId(
          req.params.driverId
        );

      if (!driverId) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Driver ID is required",
          });
      }

      /* ===================================================
         CHILDREN
      =================================================== */

      const children =
        await Child.find({
          driverId,
        }).sort({
          createdAt: 1,
        });

      /* ===================================================
         ACTIVE TRIPS
      =================================================== */

      /*
        Existing Trip status kept unchanged:

        in_transit
      */

      const trips =
        await Trips.find({
          driverId,
          status:
            "in_transit",
        });

      /* ===================================================
         ATTACH ACTIVE TRIP ID
      =================================================== */

      const data =
        children.map(
          (child) => {
            const trip =
              trips.find(
                (item) =>
                  String(
                    item.child
                  ) ===
                  String(
                    child._id
                  )
              );

            return {
              ...child.toObject(),

              tripId:
                trip?._id ||
                null,
            };
          }
        );

      return res
        .status(200)
        .json({
          success: true,
          data,
        });
    } catch (error) {
      console.error(
        "❌ DRIVER CHILDREN FETCH ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Failed to fetch Driver children",
        });
    }
  }
);

/* =========================================================
   UPDATE CHILD
========================================================= */

/*
  NEW ENDPOINT:

  PUT /api/children/:id

  Allows the Parent app to edit:

  name
  age
  school
  grade
  timings
  addresses
  coordinates

  parentId cannot be changed here.
*/

router.put(
  "/:id",
  async (req, res) => {
    try {
      const child =
        await Child.findById(
          req.params.id
        );

      if (!child) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Child not found",
          });
      }

      /* ===================================================
         PROTECTED FIELDS
      =================================================== */

      const {
        parentId,
        _id,
        __v,
        createdAt,
        updatedAt,
        status,
        registrationFeePaid,
        securityDeposit,
        depositBalance,
        routeDistance,
        estimatedDuration,
        ...updates
      } = req.body;

      /*
        parentId/status/billing/internal values
        are intentionally ignored.
      */

      /* ===================================================
         BASIC DETAILS
      =================================================== */

      if (
        updates.name !==
        undefined
      ) {
        const name =
          String(
            updates.name
          ).trim();

        if (!name) {
          return res
            .status(400)
            .json({
              success: false,

              message:
                "Child name cannot be empty",
            });
        }

        child.name =
          name;
      }

      if (
        updates.age !==
        undefined
      ) {
        if (
          updates.age ===
            null ||
          updates.age ===
            ""
        ) {
          child.age =
            null;
        } else {
          const age =
            Number(
              updates.age
            );

          if (
            !Number.isInteger(
              age
            ) ||
            age < 1 ||
            age > 25
          ) {
            return res
              .status(400)
              .json({
                success:
                  false,

                message:
                  "Age must be between 1 and 25",
              });
          }

          child.age =
            age;
        }
      }

      const stringFields = [
        "school",
        "grade",
        "pickupTime",
        "dropoffTime",
        "eveningPickup",
        "eveningDrop",
        "pickupLocation",
        "dropoffLocation",
      ];

      for (
        const field of
        stringFields
      ) {
        if (
          updates[field] !==
          undefined
        ) {
          child[field] =
            updates[field] ===
            null
              ? ""
              : String(
                  updates[
                    field
                  ]
                ).trim();
        }
      }

      /* ===================================================
         DRIVER
      =================================================== */

      if (
        updates.driverId !==
        undefined
      ) {
        child.driverId =
          normalizeDriverId(
            updates.driverId
          );
      }

      /* ===================================================
         LOCATION
      =================================================== */

      let pickup = {
        lat:
          child.location
            ?.lat ??
          null,

        lng:
          child.location
            ?.lng ??
          null,
      };

      let drop = {
        lat:
          child
            .dropLocationCoords
            ?.lat ??
          null,

        lng:
          child
            .dropLocationCoords
            ?.lng ??
          null,
      };

      try {
        if (
          updates.location !==
          undefined
        ) {
          pickup =
            getCoordinatePair(
              updates.location,
              "Pickup"
            );

          child.location = {
            lat:
              pickup.lat,

            lng:
              pickup.lng,
          };
        }

        if (
          updates.dropLocationCoords !==
          undefined
        ) {
          drop =
            getCoordinatePair(
              updates.dropLocationCoords,
              "Drop"
            );

          child.dropLocationCoords =
            {
              lat:
                drop.lat,

              lng:
                drop.lng,
            };
        }
      } catch (error) {
        return res
          .status(400)
          .json({
            success: false,
            message:
              error.message,
          });
      }

      /* ===================================================
         RECALCULATE ROUTE
      =================================================== */

      if (
        updates.location !==
          undefined ||
        updates.dropLocationCoords !==
          undefined
      ) {
        const route =
          await calculateRouteDetails(
            pickup,
            drop
          );

        child.routeDistance =
          route.routeDistance;

        child.estimatedDuration =
          route.estimatedDuration;
      }

      /* ===================================================
         SAVE
      =================================================== */

      await child.save();

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Child updated successfully",

          data: child,
        });
    } catch (error) {
      console.error(
        "❌ UPDATE CHILD ERROR:",
        error
      );

      if (
        handleCastError(
          error,
          res
        )
      ) {
        return;
      }

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
            "Failed to update child",
        });
    }
  }
);

/* =========================================================
   DELETE CHILD
========================================================= */

router.delete(
  "/:id",
  async (req, res) => {
    try {
      const child =
        await Child.findById(
          req.params.id
        );

      if (!child) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Child not found",
          });
      }

      /* ===================================================
         DELETE CHILD TRIPS
      =================================================== */

      /*
        Prevent orphaned Trip records.

        Existing Trip model uses:

        child: child._id
      */

      await Trips.deleteMany({
        child:
          child._id,
      });

      /* ===================================================
         DELETE CHILD
      =================================================== */

      await Child.findByIdAndDelete(
        child._id
      );

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Child deleted successfully",
        });
    } catch (error) {
      console.error(
        "❌ DELETE CHILD ERROR:",
        error
      );

      if (
        handleCastError(
          error,
          res
        )
      ) {
        return;
      }

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Failed to delete child",
        });
    }
  }
);

/* =========================================================
   PICKUP
========================================================= */

router.post(
  "/pickup",
  async (req, res) => {
    try {
      const {
        childId,
      } = req.body;

      if (!childId) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Child ID is required",
          });
      }

      const child =
        await Child.findById(
          childId
        );

      if (!child) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Child not found",
          });
      }

      if (
        child.status !==
        "waiting"
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Child is not waiting for pickup",
          });
      }

      child.status =
        "onboard";

      await child.save();

      /* ===================================================
         NOTIFICATION
      =================================================== */

      if (
        child.driverId
      ) {
        await safeNotify(
          req,
          {
            driverId:
              child.driverId,

            childId:
              child._id,

            title:
              "Pickup Update",

            message:
              `${child.name} picked up`,

            type:
              "pickup",

            priority:
              "high",
          }
        );
      }

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Child picked up successfully",

          data: child,
        });
    } catch (error) {
      console.error(
        "❌ PICKUP ERROR:",
        error
      );

      if (
        handleCastError(
          error,
          res
        )
      ) {
        return;
      }

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Pickup update failed",
        });
    }
  }
);

/* =========================================================
   DROP
========================================================= */

router.post(
  "/drop",
  async (req, res) => {
    try {
      const {
        childId,
      } = req.body;

      if (!childId) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Child ID is required",
          });
      }

      const child =
        await Child.findById(
          childId
        );

      if (!child) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Child not found",
          });
      }

      if (
        child.status !==
        "onboard"
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Child is not onboard",
          });
      }

      child.status =
        "dropped";

      await child.save();

      /* ===================================================
         NOTIFICATION
      =================================================== */

      if (
        child.driverId
      ) {
        await safeNotify(
          req,
          {
            driverId:
              child.driverId,

            childId:
              child._id,

            title:
              "Drop Update",

            message:
              `${child.name} dropped`,

            type:
              "drop",

            priority:
              "high",
          }
        );
      }

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Child dropped successfully",

          data: child,
        });
    } catch (error) {
      console.error(
        "❌ DROP ERROR:",
        error
      );

      if (
        handleCastError(
          error,
          res
        )
      ) {
        return;
      }

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Drop update failed",
        });
    }
  }
);

/* =========================================================
   ABSENT
========================================================= */

router.post(
  "/absent",
  async (req, res) => {
    try {
      const {
        childId,
      } = req.body;

      if (!childId) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Child ID is required",
          });
      }

      const child =
        await Child.findById(
          childId
        );

      if (!child) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Child not found",
          });
      }

      if (
        child.status !==
        "waiting"
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Only waiting children can be marked absent",
          });
      }

      child.status =
        "absent";

      await child.save();

      /* ===================================================
         NOTIFICATION
      =================================================== */

      if (
        child.driverId
      ) {
        await safeNotify(
          req,
          {
            driverId:
              child.driverId,

            childId:
              child._id,

            title:
              "Absent Update",

            message:
              `${child.name} marked absent`,

            type:
              "absent",

            priority:
              "high",
          }
        );
      }

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Child marked as absent",

          data: child,
        });
    } catch (error) {
      console.error(
        "❌ ABSENT ERROR:",
        error
      );

      if (
        handleCastError(
          error,
          res
        )
      ) {
        return;
      }

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Absent update failed",
        });
    }
  }
);

/* =========================================================
   RESET CHILD STATUS BY DRIVER
========================================================= */

router.post(
  "/reset/:driverId",
  async (req, res) => {
    try {
      const driverId =
        normalizeDriverId(
          req.params.driverId
        );

      if (!driverId) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Driver ID is required",
          });
      }

      const result =
        await Child.updateMany(
          {
            driverId,
          },
          {
            $set: {
              status:
                "waiting",
            },
          }
        );

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Child statuses reset successfully",

          modifiedCount:
            result.modifiedCount,
        });
    } catch (error) {
      console.error(
        "❌ RESET CHILD STATUS ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Failed to reset child statuses",
        });
    }
  }
);

/* =========================================================
   EXPORT
========================================================= */

export default router;
