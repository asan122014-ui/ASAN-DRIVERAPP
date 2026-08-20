import express from "express";
import jwt from "jsonwebtoken";

import Driver from "../models/Driver.js";
import Parent from "../models/Parent.js";

import {
  loginLimiter,
  signupLimiter,
} from "../middleware/rateLimiters.js";

import {
  cloudinary,
  driverUpload,
} from "../config/cloudinary.js";

import verifyParent from "../middleware/verifyParent.js";

const router = express.Router();

/* =========================================================
   HELPERS
========================================================= */

/* =========================================================
   NORMALIZE DRIVER ID
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
   CLEANUP UPLOADED CLOUDINARY FILES
========================================================= */

const cleanupUploadedFiles = async (
  files
) => {
  try {
    if (!files) {
      return;
    }

    const uploadedFiles =
      Object.values(files)
        .flat()
        .filter(
          (file) =>
            file?.filename
        );

    if (
      uploadedFiles.length ===
      0
    ) {
      return;
    }

    const results =
      await Promise.allSettled(
        uploadedFiles.map(
          (file) =>
            cloudinary.uploader.destroy(
              file.filename
            )
        )
      );

    const failed =
      results.filter(
        (result) =>
          result.status ===
          "rejected"
      );

    if (
      failed.length >
      0
    ) {
      console.warn(
        `⚠️ ${failed.length} Cloudinary cleanup operation(s) failed`
      );
    }
  } catch (error) {
    console.error(
      "CLOUDINARY CLEANUP ERROR:",
      error.message
    );
  }
};

/* =========================================================
   SAFE DRIVER RESPONSE
========================================================= */

const getSafeDriver = (
  driver
) => {
  if (!driver) {
    return null;
  }

  const data =
    typeof driver.toObject ===
    "function"
      ? driver.toObject()
      : { ...driver };

  delete data.password;

  return data;
};

/* =========================================================
   DRIVER SIGNUP
========================================================= */

router.post(
  "/signup",

  signupLimiter,

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

  async (
    req,
    res
  ) => {
    let driverSaved =
      false;

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
      } =
        req.body || {};

      /* ===================================================
         REQUIRED
      =================================================== */

      if (
        !name ||
        !phone ||
        !email ||
        !password ||
        !address ||
        latitude ===
          undefined ||
        longitude ===
          undefined ||
        !vehicleNumber ||
        !vehicleType ||
        !licenseNumber
      ) {
        await cleanupUploadedFiles(
          req.files
        );

        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "All Driver details are required",
          });
      }

      /* ===================================================
         NORMALIZE
      =================================================== */

      const normalizedName =
        String(name)
          .trim();

      const normalizedPhone =
        String(phone)
          .trim();

      const normalizedEmail =
        String(email)
          .trim()
          .toLowerCase();

      const normalizedPassword =
        String(password);

      const normalizedAddress =
        String(address)
          .trim();

      const normalizedVehicleNumber =
        String(vehicleNumber)
          .trim()
          .toUpperCase();

      const normalizedVehicleType =
        String(vehicleType)
          .trim();

      const normalizedLicenseNumber =
        String(licenseNumber)
          .trim()
          .toUpperCase();

      if (
        !normalizedName ||
        !normalizedPhone ||
        !normalizedEmail ||
        !normalizedPassword ||
        !normalizedAddress ||
        !normalizedVehicleNumber ||
        !normalizedVehicleType ||
        !normalizedLicenseNumber
      ) {
        await cleanupUploadedFiles(
          req.files
        );

        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Driver details cannot contain empty values",
          });
      }

      /* ===================================================
         PASSWORD
      =================================================== */

      if (
        normalizedPassword.length <
        6
      ) {
        await cleanupUploadedFiles(
          req.files
        );

        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Password must contain at least 6 characters",
          });
      }

      /* ===================================================
         REQUIRED DOCUMENTS
      =================================================== */

      const requiredFiles =
        [
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
        missingFiles.length >
        0
      ) {
        await cleanupUploadedFiles(
          req.files
        );

        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "All required Driver documents must be uploaded",

            missingDocuments:
              missingFiles,
          });
      }

      /* ===================================================
         EMAIL
      =================================================== */

      const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (
        !emailRegex.test(
          normalizedEmail
        )
      ) {
        await cleanupUploadedFiles(
          req.files
        );

        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Enter a valid email address",
          });
      }

      /* ===================================================
         LOCATION
      =================================================== */

      const lat =
        Number(
          latitude
        );

      const lng =
        Number(
          longitude
        );

      if (
        !Number.isFinite(
          lat
        ) ||
        !Number.isFinite(
          lng
        )
      ) {
        await cleanupUploadedFiles(
          req.files
        );

        return res
          .status(400)
          .json({
            success:
              false,

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
        await cleanupUploadedFiles(
          req.files
        );

        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Invalid location coordinates",
          });
      }

      /* ===================================================
         DUPLICATE DRIVER
      =================================================== */

      const existingDriver =
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
        }).select(
          "_id"
        );

      if (
        existingDriver
      ) {
        await cleanupUploadedFiles(
          req.files
        );

        return res
          .status(409)
          .json({
            success:
              false,

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

          password:
            normalizedPassword,

          address:
            normalizedAddress,

          homeLocation: {
            type:
              "Point",

            coordinates: [
              lng,
              lat,
            ],
          },

          location: {
            type:
              "Point",

            coordinates: [
              lng,
              lat,
            ],
          },

          lastLocation: {
            lat,
            lng,

            eta:
              "--",

            speed:
              0,

            heading:
              0,

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

          profilePhoto:
            getFilePath(
              "profilePhoto"
            ),

          profilePhotoPublicId:
            getFilePublicId(
              "profilePhoto"
            ),

          status:
            "pending",

          isOnline:
            false,

          currentStatus:
            "offline",
        });

      driver.driverId =
        `ASAN-${driver._id
          .toString()
          .slice(-6)
          .toUpperCase()}`;

      await driver.save();

      driverSaved =
        true;

      return res
        .status(201)
        .json({
          success:
            true,

          message:
            "Signup successful. Driver account is pending approval.",

          driver:
            getSafeDriver(
              driver
            ),
        });
    } catch (error) {
      if (
        !driverSaved
      ) {
        await cleanupUploadedFiles(
          req.files
        );
      }

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
            success:
              false,

            message:
              "Driver already exists",
          });
      }

      if (
        error?.name ===
        "ValidationError"
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              error.message,
          });
      }

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Signup failed",
        });
    }
  }
);

/* =========================================================
   DRIVER LOGIN
========================================================= */

router.post(
  "/login",

  loginLimiter,

  async (
    req,
    res
  ) => {
    try {
      const {
        email,
        password,
      } =
        req.body || {};

      if (
        !email ||
        !password
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Email and password are required",
          });
      }

      const normalizedEmail =
        String(
          email
        )
          .trim()
          .toLowerCase();

      const normalizedPassword =
        String(
          password
        );

      const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (
        !emailRegex.test(
          normalizedEmail
        )
      ) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Invalid credentials",
          });
      }

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
            success:
              false,

            message:
              "Invalid credentials",
          });
      }

      /* ===================================================
         PASSWORD
      =================================================== */

      const isMatch =
        await driver.comparePassword(
          normalizedPassword
        );

      if (
        !isMatch
      ) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Invalid credentials",
          });
      }

      /* ===================================================
         APPROVAL
      =================================================== */

      if (
        driver.status ===
        "pending"
      ) {
        return res
          .status(403)
          .json({
            success:
              false,

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
            success:
              false,

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
            success:
              false,

            message:
              "Driver account is not approved",
          });
      }

      /* ===================================================
         JWT CONFIG
      =================================================== */

      if (
        !process.env.JWT_SECRET
      ) {
        console.error(
          "JWT_SECRET is not configured"
        );

        return res
          .status(500)
          .json({
            success:
              false,

            message:
              "Server authentication configuration error",
          });
      }

      /* ===================================================
         DRIVER JWT
      =================================================== */

      const token =
        jwt.sign(
          {
            id:
              String(
                driver._id
              ),

            driverId:
              driver.driverId,

            tokenType:
              "driver",
          },

          process.env.JWT_SECRET,

          {
            expiresIn:
              "7d",

            algorithm:
              "HS256",
          }
        );

      /* ===================================================
         RESPONSE
      =================================================== */

      return res
        .status(200)
        .json({
          success:
            true,

          message:
            "Driver login successful",

          token,

          driver:
            getSafeDriver(
              driver
            ),
        });
    } catch (error) {
      console.error(
        "DRIVER LOGIN ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

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
  Parent authentication now uses:

  ASAN Parent JWT

  NOT Firebase Authentication.

  FCM itself still remains Firebase-based.
*/

router.post(
  "/save-token",

  verifyParent,

  async (
    req,
    res
  ) => {
    try {
      const {
        parentId,
        fcmToken,
      } =
        req.body || {};

      /* ===================================================
         OWNERSHIP
      =================================================== */

      if (
        parentId &&
        String(
          parentId
        ) !==
          String(
            req.parent._id
          )
      ) {
        return res
          .status(403)
          .json({
            success:
              false,

            message:
              "You cannot modify another Parent account",
          });
      }

      /* ===================================================
         FCM TOKEN
      =================================================== */

      const normalizedToken =
        typeof fcmToken ===
        "string"
          ? fcmToken.trim()
          : "";

      if (
        !normalizedToken
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "FCM token is required",
          });
      }

      /* ===================================================
         SAVE TOKEN
      =================================================== */

      await Parent.findByIdAndUpdate(
        req.parent._id,

        {
          $addToSet: {
            fcmTokens:
              normalizedToken,
          },
        },

        {
          runValidators:
            true,
        }
      );

      return res
        .status(200)
        .json({
          success:
            true,

          message:
            "FCM token saved successfully",
        });
    } catch (error) {
      console.error(
        "SAVE PARENT FCM TOKEN ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Failed to save token",
        });
    }
  }
);

/* =========================================================
   GET DRIVER BY CUSTOM DRIVER ID
   AUTHENTICATED PARENT
========================================================= */

router.get(
  "/by-id/:driverId",

  verifyParent,

  async (
    req,
    res
  ) => {
    try {
      const driverId =
        normalizeDriverId(
          req.params.driverId
        );

      if (
        !driverId
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Driver ID is required",
          });
      }

      const driver =
        await Driver.findOne({
          driverId,

          status:
            "approved",
        }).select(
          "driverId name vehicleNumber vehicleType vehicleModel profilePhoto status"
        );

      if (!driver) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Approved Driver not found",
          });
      }

      return res
        .status(200)
        .json({
          success:
            true,

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
          success:
            false,

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
