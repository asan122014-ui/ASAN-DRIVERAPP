import express from "express";

import Driver from "../models/Driver.js";
import Parent from "../models/Parent.js";

import {
  driverUpload,
} from "../config/cloudinary.js";

const router = express.Router();

/* =========================================================
   DRIVER SIGNUP
========================================================= */

/*
  IMPORTANT:

  Driver authentication is NOT being migrated right now.

  This existing Driver signup flow remains unchanged.
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

      /* ===============================================
         REQUIRED FIELDS
      =============================================== */

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
              "All fields are required",
          });
      }

      /* ===============================================
         NORMALIZE
      =============================================== */

      const normalizedEmail =
        String(email)
          .trim()
          .toLowerCase();

      const normalizedPhone =
        String(phone).trim();

      const lat =
        Number(latitude);

      const lng =
        Number(longitude);

      /* ===============================================
         LOCATION VALIDATION
      =============================================== */

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

      /* ===============================================
         CHECK EXISTING DRIVER
      =============================================== */

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

      /* ===============================================
         CREATE DRIVER
      =============================================== */

      const driver =
        new Driver({
          name:
            String(name).trim(),

          phone:
            normalizedPhone,

          email:
            normalizedEmail,

          password,

          address:
            String(address).trim(),

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

            updatedAt:
              new Date(),
          },

          vehicleNumber:
            String(
              vehicleNumber
            ).trim(),

          vehicleType:
            String(
              vehicleType
            ).trim(),

          licenseNumber:
            String(
              licenseNumber
            ).trim(),

          licenseFront:
            req.files
              ?.licenseFront?.[0]
              ?.path || "",

          licenseBack:
            req.files
              ?.licenseBack?.[0]
              ?.path || "",

          rcFront:
            req.files
              ?.rcFront?.[0]
              ?.path || "",

          rcBack:
            req.files
              ?.rcBack?.[0]
              ?.path || "",

          insurance:
            req.files
              ?.insurance?.[0]
              ?.path || "",

          idFront:
            req.files
              ?.idFront?.[0]
              ?.path || "",

          idBack:
            req.files
              ?.idBack?.[0]
              ?.path || "",

          profilePhoto:
            req.files
              ?.profilePhoto?.[0]
              ?.path || "",

          status:
            "pending",
        });

      /* ===============================================
         GENERATE DRIVER ID
      =============================================== */

      driver.driverId =
        `ASAN-${driver._id
          .toString()
          .slice(-6)
          .toUpperCase()}`;

      await driver.save();

      /* ===============================================
         SAFE RESPONSE
      =============================================== */

      const data =
        driver.toObject();

      delete data.password;

      return res
        .status(201)
        .json({
          success: true,

          message:
            "Signup successful",

          driver: data,
        });
    } catch (error) {
      console.error(
        "DRIVER SIGNUP ERROR:",
        error
      );

      if (
        error?.code === 11000
      ) {
        return res
          .status(409)
          .json({
            success: false,

            message:
              "Driver already exists",
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
  Existing Driver password login remains unchanged.

  Parent authentication DOES NOT use this route anymore.
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

      /* ===============================================
         FIND DRIVER
      =============================================== */

      const driver =
        await Driver.findOne({
          email:
            normalizedEmail,
        }).select(
          "+password"
        );

      if (!driver) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Invalid credentials",
          });
      }

      /* ===============================================
         APPROVAL CHECK
      =============================================== */

      if (
        driver.status !==
        "approved"
      ) {
        return res
          .status(403)
          .json({
            success: false,

            message:
              "Not approved yet",
          });
      }

      /* ===============================================
         PASSWORD CHECK
      =============================================== */

      const isMatch =
        await driver.comparePassword(
          password
        );

      if (!isMatch) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Invalid credentials",
          });
      }

      /* ===============================================
         SAFE RESPONSE
      =============================================== */

      const data =
        driver.toObject();

      delete data.password;

      return res
        .status(200)
        .json({
          success: true,

          driver: data,
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
   SAVE PARENT FCM TOKEN
========================================================= */

/*
  IMPORTANT:

  Keep this endpoint because your current Parent frontend
  already calls:

  POST /api/auth/save-token

  We will move this into a proper Parent notification/device
  route later only after verifying the frontend usage.
*/

router.post(
  "/save-token",
  async (req, res) => {
    try {
      const {
        parentId,
        fcmToken,
      } = req.body;

      /* ===============================================
         VALIDATION
      =============================================== */

      if (
        !parentId ||
        !fcmToken
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Missing parentId or token",
          });
      }

      /* ===============================================
         FIND PARENT
      =============================================== */

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

      /* ===============================================
         SAVE TOKEN WITHOUT DUPLICATES
      =============================================== */

      await Parent.findByIdAndUpdate(
        parentId,

        {
          $addToSet: {
            fcmTokens:
              fcmToken,
          },
        },

        {
          new: true,
        }
      );

      return res
        .status(200)
        .json({
          success: true,

          message:
            "Token saved",
        });
    } catch (error) {
      console.error(
        "SAVE FCM TOKEN ERROR:",
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
            "Server error",
        });
    }
  }
);

/* =========================================================
   GET DRIVER BY DRIVER ID
========================================================= */

router.get(
  "/by-id/:driverId",
  async (req, res) => {
    try {
      const driverId =
        String(
          req.params.driverId ||
            ""
        )
          .trim()
          .toUpperCase();

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
        }).select(
          "-password"
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

          driver,
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
            "Server error",
        });
    }
  }
);

/* =========================================================
   EXPORT
========================================================= */

export default router;
