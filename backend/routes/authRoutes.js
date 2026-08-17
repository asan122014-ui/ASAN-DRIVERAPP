import express from "express";

import Driver from "../models/Driver.js";
import Parent from "../models/Parent.js";

import {
  driverUpload,
} from "../config/cloudinary.js";

const router = express.Router();

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
   DRIVER SIGNUP
========================================================= */

/*
  IMPORTANT:

  Driver authentication is intentionally NOT being
  migrated in this backend cleanup phase.

  Existing password signup/login remains active.
*/

router.post(
  "/signup",

  driverUpload.fields([
    {
      name: "licenseFront",
      maxCount: 1,
    },
    {
      name: "licenseBack",
      maxCount: 1,
    },
    {
      name: "rcFront",
      maxCount: 1,
    },
    {
      name: "rcBack",
      maxCount: 1,
    },
    {
      name: "insurance",
      maxCount: 1,
    },
    {
      name: "idFront",
      maxCount: 1,
    },
    {
      name: "idBack",
      maxCount: 1,
    },
    {
      name: "profilePhoto",
      maxCount: 1,
    },
  ]),

  async (req, res) => {
    try {
      const {
        name,
        phone,
        email,
        password,
        address,
        latitude,
        longitude,
        vehicleNumber,
        vehicleType,
        licenseNumber,
      } = req.body;

      /* ===================================================
         REQUIRED TEXT FIELDS
      =================================================== */

      if (
        !name ||
        !phone ||
        !email ||
        !password ||
        !address ||
        latitude === undefined ||
        longitude === undefined ||
        !vehicleNumber ||
        !vehicleType ||
        !licenseNumber
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "All Driver details are required",
          });
      }

      /* ===================================================
         PASSWORD LENGTH
      =================================================== */

      if (
        String(password).length <
        6
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Password must contain at least 6 characters",
          });
      }

      /* ===================================================
         REQUIRED DOCUMENTS
      =================================================== */

      const requiredFiles = [
        "licenseFront",
        "licenseBack",
        "rcFront",
        "rcBack",
        "insurance",
        "idFront",
        "idBack",
      ];

      const missingFiles =
        requiredFiles.filter(
          (field) =>
            !req.files?.[
              field
            ]?.[0]?.path
        );

      if (
        missingFiles.length
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "All required Driver documents must be uploaded",

            missingDocuments:
              missingFiles,
          });
      }

      /* ===================================================
         NORMALIZE DATA
      =================================================== */

      const normalizedEmail =
        String(email)
          .trim()
          .toLowerCase();

      const normalizedPhone =
        String(phone).trim();

      const normalizedName =
        String(name).trim();

      const normalizedAddress =
        String(address).trim();

      const normalizedVehicleNumber =
        String(vehicleNumber)
          .trim()
          .toUpperCase();

      const normalizedVehicleType =
        String(vehicleType).trim();

      const normalizedLicenseNumber =
        String(licenseNumber).trim();

      /* ===================================================
         BASIC EMAIL VALIDATION
      =================================================== */

      const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (
        !emailRegex.test(
          normalizedEmail
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

      /* ===================================================
         LOCATION
      =================================================== */

      const lat =
        Number(latitude);

      const lng =
        Number(longitude);

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Valid latitude and longitude are required",
          });
      }

      if (
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Invalid location coordinates",
          });
      }

      /* ===================================================
         DUPLICATE DRIVER
      =================================================== */

      const existing =
        await Driver.findOne({
          $or: [
            {
              email:
                normalizedEmail,
            },
            {
              phone:
                normalizedPhone,
            },
          ],
        });

      if (existing) {
        return res
          .status(409)
          .json({
            success: false,

            message:
              "Driver already exists",
          });
      }

      /* ===================================================
         FILE HELPERS
      =================================================== */

      const getFilePath = (
        field
      ) =>
        req.files?.[
          field
        ]?.[0]?.path ||
        "";

      const getFilePublicId = (
        field
      ) =>
        req.files?.[
          field
        ]?.[0]?.filename ||
        "";

      /* ===================================================
         CREATE DRIVER
      =================================================== */

      const driver =
        new Driver({
          name:
            normalizedName,

          phone:
            normalizedPhone,

          email:
            normalizedEmail,

          password,

          address:
            normalizedAddress,

          homeLocation: {
            type: "Point",

            coordinates: [
              lng,
              lat,
            ],
          },

          location: {
            type: "Point",

            coordinates: [
              lng,
              lat,
            ],
          },

          lastLocation: {
            lat,
            lng,

            eta: "--",

            speed: 0,

            heading: 0,

            accuracy:
              null,

            updatedAt:
              new Date(),
          },

          vehicleNumber:
            normalizedVehicleNumber,

          vehicleType:
            normalizedVehicleType,

          licenseNumber:
            normalizedLicenseNumber,

          /* =================================================
             DRIVER DOCUMENTS
          ================================================= */

          licenseFront:
            getFilePath(
              "licenseFront"
            ),

          licenseBack:
            getFilePath(
              "licenseBack"
            ),

          rcFront:
            getFilePath(
              "rcFront"
            ),

          rcBack:
            getFilePath(
              "rcBack"
            ),

          insurance:
            getFilePath(
              "insurance"
            ),

          idFront:
            getFilePath(
              "idFront"
            ),

          idBack:
            getFilePath(
              "idBack"
            ),

          /* =================================================
             PROFILE PHOTO
          ================================================= */

          profilePhoto:
            getFilePath(
              "profilePhoto"
            ),

          profilePhotoPublicId:
            getFilePublicId(
              "profilePhoto"
            ),

          /* =================================================
             INITIAL SYSTEM STATE
          ================================================= */

          status:
            "pending",

          isOnline:
            false,

          currentStatus:
            "offline",
        });

      /* ===================================================
         GENERATE DRIVER ID
      =================================================== */

      driver.driverId =
        `ASAN-${driver._id
          .toString()
          .slice(-6)
          .toUpperCase()}`;

      /* ===================================================
         SAVE
      =================================================== */

      await driver.save();

      /* ===================================================
         SAFE RESPONSE
      =================================================== */

      const data =
        driver.toObject();

      return res
        .status(201)
        .json({
          success: true,

          message:
            "Signup successful. Driver account is pending approval.",

          driver:
            data,
        });
    } catch (error) {
      console.error(
        "DRIVER SIGNUP ERROR:",
        error
      );

      if (
        error?.code ===
        11000
      ) {
        return res
          .status(409)
          .json({
            success: false,

            message:
              "Driver already exists",
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
            "Signup failed",
        });
    }
  }
);

/* =========================================================
   DRIVER LOGIN
========================================================= */

/*
  EXISTING DRIVER PASSWORD LOGIN.

  Keep until we separately migrate the Driver app
  to its final authentication flow.
*/

router.post(
  "/login",
  async (req, res) => {
    try {
      const {
        email,
        password,
      } = req.body;

      if (
        !email ||
        !password
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Email and password are required",
          });
      }

      const normalizedEmail =
        String(email)
          .trim()
          .toLowerCase();

      /* ===================================================
         FIND DRIVER
      =================================================== */

      const driver =
        await Driver.findOne({
          email:
            normalizedEmail,
        }).select(
          "+password"
        );

      if (!driver) {
        return res
          .status(401)
          .json({
            success: false,

            message:
              "Invalid credentials",
          });
      }

      /* ===================================================
         PASSWORD CHECK
      =================================================== */

      const isMatch =
        await driver.comparePassword(
          String(password)
        );

      if (!isMatch) {
        return res
          .status(401)
          .json({
            success: false,

            message:
              "Invalid credentials",
          });
      }

      /* ===================================================
         APPROVAL STATE
      =================================================== */

      if (
        driver.status ===
        "pending"
      ) {
        return res
          .status(403)
          .json({
            success: false,

            message:
              "Driver account is pending approval",
          });
      }

      if (
        driver.status ===
        "rejected"
      ) {
        return res
          .status(403)
          .json({
            success: false,

            message:
              driver.rejectionReason
                ? `Driver account rejected: ${driver.rejectionReason}`
                : "Driver account has been rejected",
          });
      }

      if (
        driver.status !==
        "approved"
      ) {
        return res
          .status(403)
          .json({
            success: false,

            message:
              "Driver account is not approved",
          });
      }

      /* ===================================================
         SAFE DRIVER RESPONSE
      =================================================== */

      const data =
        driver.toObject();

      return res
        .status(200)
        .json({
          success: true,

          driver:
            data,
        });
    } catch (error) {
      console.error(
        "DRIVER LOGIN ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Login failed",
        });
    }
  }
);

/* =========================================================
   SAVE PARENT FCM TOKEN — LEGACY COMPATIBILITY
========================================================= */

/*
  Keep temporarily because the existing Parent frontend
  may still call:

  POST /api/auth/save-token

  New notification/device handling also exists under the
  notification module.
*/

router.post(
  "/save-token",
  async (req, res) => {
    try {
      const {
        parentId,
        fcmToken,
      } = req.body;

      const normalizedToken =
        typeof fcmToken ===
          "string"
          ? fcmToken.trim()
          : "";

      if (
        !parentId ||
        !normalizedToken
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Missing parentId or token",
          });
      }

      /* ===================================================
         UPDATE PARENT
      =================================================== */

      const parent =
        await Parent.findByIdAndUpdate(
          parentId,

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

      if (!parent) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "Parent not found",
          });
      }

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Token saved",
        });
    } catch (error) {
      console.error(
        "SAVE PARENT FCM TOKEN ERROR:",
        error
      );

      if (
        error.name ===
        "CastError"
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Invalid Parent ID",
          });
      }

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
   GET DRIVER BY CUSTOM DRIVER ID
========================================================= */

router.get(
  "/by-id/:driverId",
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

      return res
        .status(200)
        .json({
          success: true,

          driver,
        });
    } catch (error) {
      console.error(
        "GET DRIVER BY ID ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Failed to fetch Driver",
        });
    }
  }
);

/* =========================================================
   EXPORT
========================================================= */

export default router;
