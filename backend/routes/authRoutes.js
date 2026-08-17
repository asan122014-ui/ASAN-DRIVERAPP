import express from "express";

import Driver from "../models/Driver.js";
import Parent from "../models/Parent.js";

import {
  cloudinary,
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
   CLEANUP UPLOADED CLOUDINARY FILES
========================================================= */

/*
  Multer uploads files to Cloudinary BEFORE the route
  validation executes.

  Therefore, if Driver signup fails after files were uploaded,
  delete those newly uploaded files to prevent orphaned media.
*/

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
        `⚠️ ${failed.length} Cloudinary file cleanup operation(s) failed`
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

/*
  DRIVER AUTHENTICATION:

  Email + Password

  Driver Firebase/OTP migration is NOT being performed now.
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
         REQUIRED TEXT FIELDS
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
            success: false,

            message:
              "All Driver details are required",
          });
      }

      /* ===================================================
         NORMALIZE DATA
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

      /* ===================================================
         NORMALIZED REQUIRED VALUES
      =================================================== */

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
            success: false,

            message:
              "Driver details cannot contain empty values",
          });
      }

      /* ===================================================
         PASSWORD VALIDATION
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
            success: false,

            message:
              "Password must contain at least 6 characters",
          });
      }

      /* ===================================================
         REQUIRED DRIVER DOCUMENTS
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
        missingFiles.length >
        0
      ) {
        await cleanupUploadedFiles(
          req.files
        );

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
         EMAIL VALIDATION
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
            success: false,

            message:
              "Enter a valid email address",
          });
      }

      /* ===================================================
         LOCATION VALIDATION
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
        await cleanupUploadedFiles(
          req.files
        );

        return res
          .status(400)
          .json({
            success: false,

            message:
              "Invalid location coordinates",
          });
      }

      /* ===================================================
         DUPLICATE DRIVER CHECK
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
          "_id email phone"
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
      ) => {
        return (
          req.files?.[
            field
          ]?.[0]?.path ||
          ""
        );
      };

      const getFilePublicId = (
        field
      ) => {
        return (
          req.files?.[
            field
          ]?.[0]?.filename ||
          ""
        );
      };

      /* ===================================================
         CREATE DRIVER
      =================================================== */

      const driver =
        new Driver({
          /* ================= BASIC ================= */

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

          /* ================= LOCATION ================= */

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

          /* ================= VEHICLE ================= */

          vehicleNumber:
            normalizedVehicleNumber,

          vehicleType:
            normalizedVehicleType,

          licenseNumber:
            normalizedLicenseNumber,

          /* ================= DOCUMENTS ================= */

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

          /* ================= PROFILE ================= */

          profilePhoto:
            getFilePath(
              "profilePhoto"
            ),

          profilePhotoPublicId:
            getFilePublicId(
              "profilePhoto"
            ),

          /* ================= INITIAL STATE ================= */

          status:
            "pending",

          isOnline:
            false,

          currentStatus:
            "offline",
        });

      /* ===================================================
         CUSTOM DRIVER ID
      =================================================== */

      driver.driverId =
        `ASAN-${driver._id
          .toString()
          .slice(-6)
          .toUpperCase()}`;

      /* ===================================================
         SAVE DRIVER
      =================================================== */

      await driver.save();

      driverSaved =
        true;

      /* ===================================================
         SAFE RESPONSE
      =================================================== */

      const data =
        getSafeDriver(
          driver
        );

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
      /*
        Delete uploaded Cloudinary files only if
        Driver creation did NOT complete successfully.
      */

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

      /* ===================================================
         DUPLICATE KEY
      =================================================== */

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

      /* ===================================================
         MONGOOSE VALIDATION
      =================================================== */

      if (
        error?.name ===
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

      /* ===================================================
         GENERIC ERROR
      =================================================== */

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
  Current Driver authentication:

  Email
    +
  Password

  Driver must also be approved by Admin.
*/

router.post(
  "/login",

  async (req, res) => {
    try {
      const {
        email,
        password,
      } =
        req.body || {};

      /* ===================================================
         REQUIRED
      =================================================== */

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

      const normalizedPassword =
        String(password);

      /* ===================================================
         EMAIL FORMAT
      =================================================== */

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
            success: false,

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
          normalizedPassword
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
         DRIVER APPROVAL STATE
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
        getSafeDriver(
          driver
        );

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
   SAVE PARENT FCM TOKEN
   LEGACY COMPATIBILITY
========================================================= */

/*
  Existing Parent frontend may still call:

  POST /api/auth/save-token

  Keep this endpoint temporarily.

  Authentication/ownership protection will be added
  during the final security phase.
*/

router.post(
  "/save-token",

  async (req, res) => {
    try {
      const {
        parentId,
        fcmToken,
      } =
        req.body || {};

      const normalizedToken =
        typeof fcmToken ===
        "string"
          ? fcmToken.trim()
          : "";

      /* ===================================================
         VALIDATION
      =================================================== */

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

            runValidators:
              true,
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
        error?.name ===
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

/*
  Used by Parent-side Driver linking/search flow.

  Fine-grained authorization and response-field restriction
  can be added during the final security phase.
*/

router.get(
  "/by-id/:driverId",

  async (req, res) => {
    try {
      const driverId =
        normalizeDriverId(
          req.params.driverId
        );

      /* ===================================================
         VALIDATION
      =================================================== */

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
         FIND DRIVER
      =================================================== */

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
         SAFE RESPONSE
      =================================================== */

      const data =
        getSafeDriver(
          driver
        );

      return res
        .status(200)
        .json({
          success: true,

          driver:
            data,
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
