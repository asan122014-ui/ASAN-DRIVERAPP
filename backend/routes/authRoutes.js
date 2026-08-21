import express from "express";

import Driver from "../models/Driver.js";
import Parent from "../models/Parent.js";

import {
  signupLimiter,
} from "../middleware/rateLimiters.js";

import {
  cloudinary,
  driverUpload,
} from "../config/cloudinary.js";

import verifyParent from "../middleware/verifyParent.js";

const router =
  express.Router();

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
   NORMALIZE PHONE
========================================================= */

const normalizePhone = (
  phone
) => {
  return String(
    phone || ""
  )
    .replace(
      /\D/g,
      ""
    )
    .slice(
      0,
      10
    );
};

/* =========================================================
   NORMALIZE EMAIL
========================================================= */

const normalizeEmail = (
  email
) => {
  return String(
    email || ""
  )
    .trim()
    .toLowerCase();
};

/* =========================================================
   CLEANUP UPLOADED CLOUDINARY FILES
========================================================= */

const cleanupUploadedFiles =
  async (
    files
  ) => {
    try {
      if (
        !files
      ) {
        return;
      }

      const uploadedFiles =
        Object.values(
          files
        )
          .flat()
          .filter(
            (
              file
            ) =>
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
            (
              file
            ) =>
              cloudinary
                .uploader
                .destroy(
                  file.filename
                )
          )
        );

      const failed =
        results.filter(
          (
            result
          ) =>
            result.status ===
            "rejected"
        );

      if (
        failed.length >
        0
      ) {
        console.warn(
          `${failed.length} Cloudinary cleanup operation(s) failed`
        );
      }
    } catch (
      error
    ) {
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
  if (
    !driver
  ) {
    return null;
  }

  const data =
    typeof driver.toObject ===
    "function"
      ? driver.toObject()
      : {
          ...driver,
        };

  delete data.password;
  delete data.__v;

  return data;
};

/* =========================================================
   DRIVER SIGNUP
========================================================= */

/*
  POST /api/auth/signup

  Driver registration remains here for now.

  After successful registration:

  status = pending

  Driver must later login through:

  POST /api/driver-auth/login
*/

router.post(
  "/signup",

  signupLimiter,

  driverUpload.fields([
    {
      name:
        "licenseFront",

      maxCount:
        1,
    },

    {
      name:
        "licenseBack",

      maxCount:
        1,
    },

    {
      name:
        "rcFront",

      maxCount:
        1,
    },

    {
      name:
        "rcBack",

      maxCount:
        1,
    },

    {
      name:
        "insurance",

      maxCount:
        1,
    },

    {
      name:
        "idFront",

      maxCount:
        1,
    },

    {
      name:
        "idBack",

      maxCount:
        1,
    },

    {
      name:
        "profilePhoto",

      maxCount:
        1,
    },
  ]),

  async (
    req,
    res
  ) => {
    let driverSaved =
      false;

    try {
      /* ===================================================
         INPUT
      =================================================== */

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
        vehicleModel,
      } =
        req.body ||
        {};

      /* ===================================================
         REQUIRED DETAILS
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
        String(
          name
        ).trim();

      const normalizedPhone =
        normalizePhone(
          phone
        );

      const normalizedEmail =
        normalizeEmail(
          email
        );

      const normalizedPassword =
        String(
          password
        );

      const normalizedAddress =
        String(
          address
        ).trim();

      const normalizedVehicleNumber =
        String(
          vehicleNumber
        )
          .trim()
          .toUpperCase()
          .replace(
            /\s+/g,
            ""
          );

      const normalizedVehicleType =
        String(
          vehicleType
        ).trim();

      const normalizedLicenseNumber =
        String(
          licenseNumber
        )
          .trim()
          .toUpperCase();

      const normalizedVehicleModel =
        String(
          vehicleModel ||
            ""
        ).trim();

      /* ===================================================
         EMPTY VALUES
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
            success:
              false,

            message:
              "Driver details cannot contain empty values",
          });
      }

      /* ===================================================
         PHONE
      =================================================== */

      if (
        !/^[6-9]\d{9}$/.test(
          normalizedPhone
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
              "Enter a valid 10-digit mobile number",
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
          (
            field
          ) =>
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
          /* =================================================
             PERSONAL
          ================================================= */

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

          /* =================================================
             HOME LOCATION
          ================================================= */

          homeLocation: {
            type:
              "Point",

            coordinates: [
              lng,
              lat,
            ],
          },

          /*
            Registration location is initially used
            as Driver's current location too.

            Once live tracking begins this will be
            replaced by the latest GPS position.
          */

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

          /* =================================================
             VEHICLE
          ================================================= */

          vehicleNumber:
            normalizedVehicleNumber,

          vehicleType:
            normalizedVehicleType,

          vehicleModel:
            normalizedVehicleModel,

          licenseNumber:
            normalizedLicenseNumber,

          /* =================================================
             DOCUMENTS
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

          profilePhoto:
            getFilePath(
              "profilePhoto"
            ),

          profilePhotoPublicId:
            getFilePublicId(
              "profilePhoto"
            ),

          /* =================================================
             STATUS
          ================================================= */

          status:
            "pending",

          rejectionReason:
            null,

          isOnline:
            false,

          currentStatus:
            "offline",
        });

      /* ===================================================
         PUBLIC DRIVER ID
      =================================================== */

      /*
        Driver ID is created using the MongoDB ID.

        Example:

        ASAN-AB12CD
      */

      driver.driverId =
        `ASAN-${driver._id
          .toString()
          .slice(
            -6
          )
          .toUpperCase()}`;

      /* ===================================================
         SAVE
      =================================================== */

      await driver.save();

      driverSaved =
        true;

      /* ===================================================
         RESPONSE
      =================================================== */

      return res
        .status(201)
        .json({
          success:
            true,

          message:
            "Signup successful. Driver account is pending approval.",

          status:
            "pending",

          code:
            "DRIVER_PENDING",

          nextStep:
            "approval-pending",

          data:
            getSafeDriver(
              driver
            ),
        });
    } catch (
      error
    ) {
      /* ===================================================
         CLOUDINARY CLEANUP
      =================================================== */

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
         DUPLICATE
      =================================================== */

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

      /* ===================================================
         VALIDATION
      =================================================== */

      if (
        error?.name ===
        "ValidationError"
      ) {
        const validationMessage =
          Object.values(
            error.errors ||
              {}
          )?.[0]
            ?.message ||
          error.message;

        return res
          .status(400)
          .json({
            success:
              false,

            message:
              validationMessage,
          });
      }

      /* ===================================================
         SERVER ERROR
      =================================================== */

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
   OLD DRIVER LOGIN REMOVED
========================================================= */

/*
  IMPORTANT:

  Driver login no longer exists here.

  OLD:

  POST /api/auth/login

  NEW:

  POST /api/driver-auth/login

  New login uses:

  controllers/driverAuthController.js

  and generates:

  {
    id: "<MongoDB Driver _id>",
    tokenType: "driver"
  }

  This prevents two different Driver JWT formats
  from existing in the application.
*/

/* =========================================================
   SAVE PARENT FCM TOKEN
========================================================= */

/*
  Parent authentication uses ASAN Parent JWT.

  Firebase is used only for FCM Messaging.
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
        req.body ||
        {};

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
         TOKEN
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
         SAVE
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
    } catch (
      error
    ) {
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

/*
  Used when a Parent enters:

  ASAN-XXXXXX

  during Driver linking.
*/

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
          req.params
            .driverId
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

      /* ===================================================
         APPROVED DRIVER ONLY
      =================================================== */

      const driver =
        await Driver.findOne({
          driverId,

          status:
            "approved",
        })
          .select(
            [
              "driverId",
              "name",
              "vehicleNumber",
              "vehicleType",
              "vehicleModel",
              "profilePhoto",
              "avatar",
              "status",
            ].join(" ")
          )
          .lean();

      if (
        !driver
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Approved Driver not found",
          });
      }

      /* ===================================================
         RESPONSE
      =================================================== */

      return res
        .status(200)
        .json({
          success:
            true,

          data: {
            ...driver,

            profilePhoto:
              driver
                .profilePhoto ||
              driver.avatar ||
              "",
          },
        });
    } catch (
      error
    ) {
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
