import express from "express";
import mongoose from "mongoose";

import Driver from "../models/Driver.js";
import Trips from "../models/Trips.js";
import Child from "../models/Child.js";

import {
  cloudinary,
  driverUpload,
} from "../config/cloudinary.js";

const router = express.Router();

/* =========================================================
   CONSTANTS
========================================================= */

const IST_OFFSET_MS =
  5.5 * 60 * 60 * 1000;

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
   SAFE REGEX
========================================================= */

const escapeRegex = (
  value
) => {
  return String(value)
    .replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );
};

/* =========================================================
   FIND DRIVER
========================================================= */

/*
  Supports:

  ASAN-XXXXXX

  OR

  MongoDB Driver _id
*/

const findDriver =
  async (
    identifier
  ) => {
    if (!identifier) {
      return null;
    }

    const value =
      String(identifier)
        .trim();

    if (!value) {
      return null;
    }

    /* =====================================================
       CUSTOM DRIVER ID FIRST
    ===================================================== */

    const normalizedDriverId =
      normalizeDriverId(
        value
      );

    const driverByCustomId =
      await Driver.findOne({
        driverId:
          normalizedDriverId,
      });

    if (
      driverByCustomId
    ) {
      return driverByCustomId;
    }

    /* =====================================================
       MONGODB ID FALLBACK
    ===================================================== */

    if (
      mongoose.Types.ObjectId.isValid(
        value
      )
    ) {
      return Driver.findById(
        value
      );
    }

    return null;
  };

/* =========================================================
   IST DAY RANGE
========================================================= */

const getTodayRangeIST = () => {
  const now =
    new Date();

  const istNow =
    new Date(
      now.getTime() +
        IST_OFFSET_MS
    );

  const year =
    istNow.getUTCFullYear();

  const month =
    istNow.getUTCMonth();

  const day =
    istNow.getUTCDate();

  const start =
    new Date(
      Date.UTC(
        year,
        month,
        day,
        0,
        0,
        0,
        0
      ) -
        IST_OFFSET_MS
    );

  const end =
    new Date(
      Date.UTC(
        year,
        month,
        day + 1,
        0,
        0,
        0,
        0
      ) -
        IST_OFFSET_MS
    );

  return {
    start,
    end,
  };
};

/* =========================================================
   SAVE DRIVER FCM TOKEN
========================================================= */

router.post(
  "/save-token",
  async (req, res) => {
    try {
      const {
        driverId,
        token,
      } = req.body;

      const normalizedDriverId =
        normalizeDriverId(
          driverId
        );

      const normalizedToken =
        typeof token ===
          "string"
          ? token.trim()
          : "";

      if (
        !normalizedDriverId ||
        !normalizedToken
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "driverId and token are required",
          });
      }

      const driver =
        await Driver.findOneAndUpdate(
          {
            driverId:
              normalizedDriverId,
          },

          {
            $addToSet: {
              fcmTokens:
                normalizedToken,
            },
          },

          {
            new: true,
          }
        );

      if (!driver) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Driver not found",
          });
      }

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Token saved successfully",
        });
    } catch (error) {
      console.error(
        "SAVE DRIVER TOKEN ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Failed to save token",
        });
    }
  }
);

/* =========================================================
   GET ALL DRIVERS
========================================================= */

/*
  Eventually this should become Admin-only.
*/

router.get(
  "/",
  async (req, res) => {
    try {
      const drivers =
        await Driver.find()
          .select(
            "name driverId vehicleNumber vehicleType status"
          )
          .sort({
            name: 1,
          })
          .lean();

      return res
        .status(200)
        .json({
          success: true,

          count:
            drivers.length,

          data:
            drivers,
        });
    } catch (error) {
      console.error(
        "GET ALL DRIVERS ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Failed to fetch drivers",
        });
    }
  }
);

/* =========================================================
   SEARCH DRIVERS
========================================================= */

router.get(
  "/search",
  async (req, res) => {
    try {
      const query =
        String(
          req.query.query ||
            ""
        ).trim();

      if (!query) {
        return res
          .status(200)
          .json({
            success: true,
            data: [],
          });
      }

      /*
        Avoid passing raw user input
        directly into MongoDB regex.
      */

      const safeQuery =
        escapeRegex(
          query
        );

      const drivers =
        await Driver.find({
          $or: [
            {
              name: {
                $regex:
                  safeQuery,

                $options:
                  "i",
              },
            },

            {
              phone: {
                $regex:
                  safeQuery,

                $options:
                  "i",
              },
            },

            {
              driverId: {
                $regex:
                  safeQuery,

                $options:
                  "i",
              },
            },
          ],
        })
          .select(
            "name phone driverId vehicleNumber vehicleType status"
          )
          .limit(10)
          .lean();

      return res
        .status(200)
        .json({
          success: true,
          data: drivers,
        });
    } catch (error) {
      console.error(
        "DRIVER SEARCH ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Search failed",
        });
    }
  }
);

/* =========================================================
   GET DRIVER LAST LOCATION
========================================================= */

router.get(
  "/location",
  async (req, res) => {
    try {
      const {
        driverId,
      } = req.query;

      if (!driverId) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Driver ID is required",
          });
      }

      const driver =
        await findDriver(
          driverId
        );

      if (!driver) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Driver not found",
          });
      }

      return res
        .status(200)
        .json({
          success: true,

          data: {
            driverId:
              driver.driverId,

            isOnline:
              driver.isOnline,

            currentStatus:
              driver.currentStatus,

            lastLocation:
              driver.lastLocation ||
              null,
          },
        });
    } catch (error) {
      console.error(
        "GET DRIVER LOCATION ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Failed to fetch driver location",
        });
    }
  }
);

/* =========================================================
   DRIVER DASHBOARD
========================================================= */

router.get(
  "/dashboard/:driverId",
  async (req, res) => {
    try {
      const driver =
        await findDriver(
          req.params.driverId
        );

      if (!driver) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Driver not found",
          });
      }

      /*
        IMPORTANT:

        Even if MongoDB _id was supplied in the URL,
        Trip and Child schemas use the custom driverId.
      */

      const driverId =
        driver.driverId;

      if (!driverId) {
        return res
          .status(409)
          .json({
            success: false,

            message:
              "Driver ID is not configured",
          });
      }

      const {
        start,
        end,
      } =
        getTodayRangeIST();

      const [
        totalTrips,
        todayTrips,
        studentsAssigned,
      ] =
        await Promise.all([
          Trips.countDocuments({
            driverId,
          }),

          Trips.countDocuments({
            driverId,

            createdAt: {
              $gte: start,
              $lt: end,
            },
          }),

          Child.countDocuments({
            driverId,
          }),
        ]);

      return res
        .status(200)
        .json({
          success: true,

          data: {
            driverId,

            name:
              driver.name,

            vehicleNumber:
              driver.vehicleNumber,

            vehicleType:
              driver.vehicleType,

            rating:
              driver.rating,

            status:
              driver.status,

            isOnline:
              driver.isOnline,

            currentStatus:
              driver.currentStatus,

            totalTrips,

            todayTrips,

            studentsAssigned,
          },
        });
    } catch (error) {
      console.error(
        "DRIVER DASHBOARD ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Failed to load dashboard",
        });
    }
  }
);

/* =========================================================
   DRIVER PROFILE
========================================================= */

router.get(
  "/profile/:driverId",
  async (req, res) => {
    try {
      const driver =
        await findDriver(
          req.params.driverId
        );

      if (!driver) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Driver not found",
          });
      }

      const driverId =
        driver.driverId;

      const {
        start,
        end,
      } =
        getTodayRangeIST();

      const todayTrips =
        driverId
          ? await Trips.countDocuments({
              driverId,

              createdAt: {
                $gte: start,
                $lt: end,
              },
            })
          : 0;

      return res
        .status(200)
        .json({
          success: true,

          data: {
            ...driver.toObject(),

            todayTrips,
          },
        });
    } catch (error) {
      console.error(
        "DRIVER PROFILE ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Failed to load profile",
        });
    }
  }
);

/* =========================================================
   DRIVER TRACKING
========================================================= */

router.get(
  "/tracking/:driverId",
  async (req, res) => {
    try {
      const driver =
        await findDriver(
          req.params.driverId
        );

      if (!driver) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Driver not found",
          });
      }

      return res
        .status(200)
        .json({
          success: true,

          data: {
            driverId:
              driver.driverId,

            name:
              driver.name,

            phone:
              driver.phone,

            vehicleNumber:
              driver.vehicleNumber,

            vehicleType:
              driver.vehicleType,

            isOnline:
              driver.isOnline,

            currentStatus:
              driver.currentStatus,

            /*
              GeoJSON location used for
              map/nearby queries.
            */

            location:
              driver.location,

            /*
              Latest Socket.IO location.
            */

            lastLocation:
              driver.lastLocation,
          },
        });
    } catch (error) {
      console.error(
        "DRIVER TRACKING ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Tracking failed",
        });
    }
  }
);

/* =========================================================
   UPDATE DRIVER PROFILE
========================================================= */

/*
  This endpoint is strictly for normal
  Driver profile information.

  It MUST NOT modify:

  authentication
  approval
  trip state
  location
  FCM
  system statistics
*/

router.put(
  "/update",

  driverUpload.single(
    "profilePhoto"
  ),

  async (req, res) => {
    try {
      const {
        driverId:
          rawDriverId,

        ...updates
      } = req.body;

      const driverId =
        normalizeDriverId(
          rawDriverId
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

      const driver =
        await Driver.findOne({
          driverId,
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
         PROFILE IMAGE
      =================================================== */

      let oldPhotoPublicId =
        null;

      if (req.file) {
        oldPhotoPublicId =
          driver
            .profilePhotoPublicId ||
          null;

        driver.profilePhoto =
          req.file.path;

        driver.profilePhotoPublicId =
          req.file.filename;
      }

      /* ===================================================
         PROFILE FIELD ALLOWLIST
      =================================================== */

      /*
        Only these fields may be changed from
        this normal profile endpoint.
      */

      const allowedFields =
        [
          "name",
          "email",
          "address",
          "vehicleNumber",
          "vehicleType",
          "vehicleModel",
          "licenseNumber",
          "avatar",
        ];

      for (
        const field of
        allowedFields
      ) {
        if (
          updates[field] ===
          undefined
        ) {
          continue;
        }

        if (
          typeof updates[
            field
          ] === "string"
        ) {
          updates[field] =
            updates[
              field
            ].trim();
        }

        driver[field] =
          updates[field];
      }

      /* ===================================================
         NORMALIZE EMAIL
      =================================================== */

      if (
        updates.email !==
        undefined
      ) {
        const email =
          String(
            updates.email
          )
            .trim()
            .toLowerCase();

        const emailRegex =
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (
          !emailRegex.test(
            email
          )
        ) {
          return res
            .status(400)
            .json({
              success: false,

              message:
                "Enter a valid email address",
            });
        }

        const duplicateEmail =
          await Driver.findOne({
            email,

            _id: {
              $ne:
                driver._id,
            },
          });

        if (
          duplicateEmail
        ) {
          return res
            .status(409)
            .json({
              success: false,

              message:
                "Email is already registered",
            });
        }

        driver.email =
          email;
      }

      /* ===================================================
         NORMALIZE VEHICLE NUMBER
      =================================================== */

      if (
        updates.vehicleNumber !==
        undefined
      ) {
        driver.vehicleNumber =
          String(
            updates.vehicleNumber
          )
            .trim()
            .toUpperCase();
      }

      /* ===================================================
         SAVE DRIVER
      =================================================== */

      await driver.save();

      /* ===================================================
         REMOVE OLD PROFILE IMAGE
      =================================================== */

      /*
        Delete old Cloudinary image only AFTER
        the Driver document successfully saves.

        This avoids losing the old image if
        MongoDB validation fails.
      */

      if (
        req.file &&
        oldPhotoPublicId &&
        oldPhotoPublicId !==
          driver
            .profilePhotoPublicId
      ) {
        try {
          await cloudinary
            .uploader
            .destroy(
              oldPhotoPublicId
            );
        } catch (
          cloudinaryError
        ) {
          console.error(
            "OLD DRIVER PHOTO DELETE ERROR:",
            cloudinaryError.message
          );
        }
      }

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Driver updated successfully",

          data:
            driver,
        });
    } catch (error) {
      console.error(
        "DRIVER UPDATE ERROR:",
        error
      );

      if (
        error.code ===
        11000
      ) {
        return res
          .status(409)
          .json({
            success: false,

            message:
              "Driver information already exists",
          });
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
            "Update failed",
        });
    }
  }
);

/* =========================================================
   GET DRIVER BY ID
========================================================= */

/*
  Keep this LAST because /:id can otherwise
  interfere with named routes.
*/

router.get(
  "/:id",
  async (req, res) => {
    try {
      const driver =
        await findDriver(
          req.params.id
        );

      if (!driver) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Driver not found",
          });
      }

      return res
        .status(200)
        .json({
          success: true,
          data: driver,
        });
    } catch (error) {
      console.error(
        "GET DRIVER ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Failed to fetch driver",
        });
    }
  }
);

export default router;
