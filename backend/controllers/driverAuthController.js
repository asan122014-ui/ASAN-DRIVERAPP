import crypto from "crypto";
import jwt from "jsonwebtoken";

import Driver from "../models/Driver.js";
import Otp from "../models/Otp.js";

import {
  cloudinary,
} from "../config/cloudinary.js";

import {
  sendDriverOtpEmail,
} from "../services/emailService.js";

/* =========================================================
   CONFIG
========================================================= */

const OTP_EXPIRY_MINUTES =
  5;

const OTP_RESEND_COOLDOWN_SECONDS =
  60;

const OTP_MAX_ATTEMPTS =
  5;

const DRIVER_LOGIN_PURPOSE =
  "driver_login";

const DRIVER_REGISTER_PURPOSE =
  "driver_register";

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
   EMAIL VALIDATION
========================================================= */

const isValidEmail = (
  email
) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email
  );
};

/* =========================================================
   NORMALIZE PHONE
========================================================= */

const normalizePhone = (
  phone
) => {
  return String(
    phone || ""
  ).replace(
    /\D/g,
    ""
  );
};

/* =========================================================
   PHONE VALIDATION
========================================================= */

const isValidPhone = (
  phone
) => {
  return /^[6-9]\d{9}$/.test(
    phone
  );
};

/* =========================================================
   VALIDATE LOCATION
========================================================= */

const validateCoordinates = (
  latitude,
  longitude
) => {
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
    return {
      valid:
        false,

      message:
        "Valid latitude and longitude are required",
    };
  }

  if (
    lat < -90 ||
    lat > 90
  ) {
    return {
      valid:
        false,

      message:
        "Latitude must be between -90 and 90",
    };
  }

  if (
    lng < -180 ||
    lng > 180
  ) {
    return {
      valid:
        false,

      message:
        "Longitude must be between -180 and 180",
    };
  }

  return {
    valid:
      true,

    latitude:
      lat,

    longitude:
      lng,
  };
};

/* =========================================================
   GENERATE OTP
========================================================= */

const generateOtp =
  () => {
    return crypto
      .randomInt(
        100000,
        1000000
      )
      .toString();
  };

/* =========================================================
   HASH OTP
========================================================= */

const hashOtp = (
  otp
) => {
  return crypto
    .createHash(
      "sha256"
    )
    .update(
      String(
        otp
      )
    )
    .digest(
      "hex"
    );
};

/* =========================================================
   SAFE OTP HASH COMPARISON
========================================================= */

const compareOtpHash = (
  suppliedOtp,
  storedHash
) => {
  const suppliedHash =
    hashOtp(
      suppliedOtp
    );

  if (
    !storedHash ||
    suppliedHash.length !==
      storedHash.length
  ) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(
      Buffer.from(
        suppliedHash,
        "hex"
      ),

      Buffer.from(
        storedHash,
        "hex"
      )
    );
  } catch {
    return false;
  }
};

/* =========================================================
   VALIDATE OTP INPUT
========================================================= */

const validateOtpInput = (
  otp
) => {
  const value =
    String(
      otp || ""
    ).trim();

  if (
    !/^\d{6}$/.test(
      value
    )
  ) {
    return null;
  }

  return value;
};

/* =========================================================
   SAFE DRIVER
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
    typeof driver.toJSON ===
    "function"
      ? driver.toJSON()
      : {
          ...driver,
        };

  /*
    Legacy protection.

    Password no longer exists in the current Driver schema,
    but old MongoDB records may still contain the field.
  */

  delete data.password;
  delete data.__v;

  return data;
};

/* =========================================================
   CREATE DRIVER JWT
========================================================= */

const createDriverToken = (
  driver
) => {
  if (
    !process.env
      .JWT_SECRET
  ) {
    throw new Error(
      "JWT_SECRET is not configured"
    );
  }

  if (
    !driver?._id
  ) {
    throw new Error(
      "Driver account ID is missing"
    );
  }

  return jwt.sign(
    {
      id:
        String(
          driver._id
        ),

      tokenType:
        "driver",
    },

    process.env.JWT_SECRET,

    {
      algorithm:
        "HS256",

      expiresIn:
        "7d",
    }
  );
};

/* =========================================================
   DRIVER STATUS INFORMATION
========================================================= */

const getDriverStatusInfo = (
  driver
) => {
  if (
    driver.status ===
    "approved"
  ) {
    return {
      status:
        "approved",

      code:
        "DRIVER_APPROVED",

      nextStep:
        "dashboard",

      message:
        "Login successful",

      rejectionReason:
        null,
    };
  }

  if (
    driver.status ===
    "pending"
  ) {
    return {
      status:
        "pending",

      code:
        "DRIVER_PENDING",

      nextStep:
        "approval-pending",

      message:
        "Your Driver application is under review",

      rejectionReason:
        null,
    };
  }

  if (
    driver.status ===
    "rejected"
  ) {
    return {
      status:
        "rejected",

      code:
        "DRIVER_REJECTED",

      nextStep:
        "application-rejected",

      message:
        "Your Driver application was rejected",

      rejectionReason:
        driver
          .rejectionReason ||
        null,
    };
  }

  return {
    status:
      driver.status ||
      "unknown",

    code:
      "DRIVER_STATUS_UNKNOWN",

    nextStep:
      "status",

    message:
      "Driver account status could not be determined",

    rejectionReason:
      null,
  };
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
          `${failed.length} Driver file cleanup operation(s) failed`
        );
      }
    } catch (
      error
    ) {
      console.error(
        "DRIVER CLOUDINARY CLEANUP ERROR:",
        error.message
      );
    }
  };

/* =========================================================
   CREATE AND SEND OTP
========================================================= */

const createAndSendDriverOtp =
  async ({
    email,
    purpose,
  }) => {
    const existingOtp =
      await Otp.findOne({
        email,
        purpose,
      });

    /* =====================================================
       RESEND COOLDOWN
    ===================================================== */

    if (
      existingOtp
        ?.lastSentAt
    ) {
      const millisecondsSinceLastOtp =
        Date.now() -
        new Date(
          existingOtp
            .lastSentAt
        ).getTime();

      const cooldownMilliseconds =
        OTP_RESEND_COOLDOWN_SECONDS *
        1000;

      if (
        millisecondsSinceLastOtp <
        cooldownMilliseconds
      ) {
        const secondsRemaining =
          Math.ceil(
            (
              cooldownMilliseconds -
              millisecondsSinceLastOtp
            ) /
              1000
          );

        return {
          success:
            false,

          cooldown:
            true,

          secondsRemaining,
        };
      }
    }

    /* =====================================================
       GENERATE OTP
    ===================================================== */

    const otp =
      generateOtp();

    const otpHash =
      hashOtp(
        otp
      );

    const now =
      new Date();

    const expiresAt =
      new Date(
        Date.now() +
          OTP_EXPIRY_MINUTES *
            60 *
            1000
      );

    /* =====================================================
       STORE HASH
    ===================================================== */

    await Otp.findOneAndUpdate(
      {
        email,
        purpose,
      },

      {
        $set: {
          otpHash,

          expiresAt,

          attempts:
            0,

          maxAttempts:
            OTP_MAX_ATTEMPTS,

          used:
            false,

          lastSentAt:
            now,
        },

        $inc: {
          resendCount:
            1,
        },

        $setOnInsert: {
          email,
          purpose,
        },
      },

      {
        upsert:
          true,

        new:
          true,

        runValidators:
          true,
      }
    );

    /* =====================================================
       EMAIL PURPOSE
    ===================================================== */

    const emailPurpose =
      purpose ===
      DRIVER_REGISTER_PURPOSE
        ? "register"
        : "login";

    /* =====================================================
       SEND EMAIL
    ===================================================== */

    try {
      await sendDriverOtpEmail({
        email,
        otp,

        purpose:
          emailPurpose,
      });
    } catch (
      error
    ) {
      /*
        Delete unsent OTP.
      */

      await Otp.deleteOne({
        email,
        purpose,
        otpHash,
      });

      throw error;
    }

    return {
      success:
        true,

      expiresIn:
        OTP_EXPIRY_MINUTES *
        60,
    };
  };

/* =========================================================
   VERIFY STORED OTP
========================================================= */

const verifyStoredDriverOtp =
  async ({
    email,
    otp,
    purpose,
    consume = true,
  }) => {
    const storedOtp =
      await Otp.findOne({
        email,
        purpose,

        used:
          false,
      });

    /* =====================================================
       NOT FOUND
    ===================================================== */

    if (
      !storedOtp
    ) {
      return {
        valid:
          false,

        status:
          400,

        message:
          "OTP is invalid or has expired",
      };
    }

    /* =====================================================
       EXPIRED
    ===================================================== */

    if (
      !storedOtp
        .expiresAt ||
      storedOtp
        .expiresAt
        .getTime() <=
        Date.now()
    ) {
      await Otp.deleteOne({
        _id:
          storedOtp._id,
      });

      return {
        valid:
          false,

        status:
          400,

        message:
          "OTP has expired. Please request a new OTP.",
      };
    }

    /* =====================================================
       MAX ATTEMPTS
    ===================================================== */

    if (
      storedOtp.attempts >=
      storedOtp.maxAttempts
    ) {
      await Otp.deleteOne({
        _id:
          storedOtp._id,
      });

      return {
        valid:
          false,

        status:
          429,

        message:
          "Too many incorrect attempts. Please request a new OTP.",
      };
    }

    /* =====================================================
       COMPARE
    ===================================================== */

    const valid =
      compareOtpHash(
        otp,
        storedOtp.otpHash
      );

    if (
      !valid
    ) {
      storedOtp.attempts +=
        1;

      await storedOtp.save();

      const attemptsRemaining =
        Math.max(
          0,

          storedOtp.maxAttempts -
            storedOtp.attempts
        );

      if (
        attemptsRemaining ===
        0
      ) {
        await Otp.deleteOne({
          _id:
            storedOtp._id,
        });

        return {
          valid:
            false,

          status:
            429,

          message:
            "Too many incorrect attempts. Please request a new OTP.",
        };
      }

      return {
        valid:
          false,

        status:
          400,

        message:
          `Incorrect OTP. ${attemptsRemaining} attempt${
            attemptsRemaining ===
            1
              ? ""
              : "s"
          } remaining.`,
      };
    }

    /* =====================================================
       CONSUME
    ===================================================== */

    if (
      consume
    ) {
      await Otp.deleteOne({
        _id:
          storedOtp._id,
      });
    }

    return {
      valid:
        true,

      storedOtp,
    };
  };

/* =========================================================
   SEND DRIVER REGISTRATION OTP
========================================================= */

/*
  POST /api/driver-auth/send-register-otp

  BODY:

  {
    "email": "driver@example.com"
  }
*/

export const sendRegisterOtp =
  async (
    req,
    res
  ) => {
    try {
      const email =
        normalizeEmail(
          req.body
            ?.email
        );

      /* ===================================================
         EMAIL
      =================================================== */

      if (
        !email ||
        !isValidEmail(
          email
        )
      ) {
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
         ALREADY REGISTERED
      =================================================== */

      const existingDriver =
        await Driver.findByEmail(
          email
        );

      if (
        existingDriver
      ) {
        return res
          .status(409)
          .json({
            success:
              false,

            message:
              "This email is already registered. Please sign in instead.",
          });
      }

      /* ===================================================
         SEND OTP
      =================================================== */

      const result =
        await createAndSendDriverOtp({
          email,

          purpose:
            DRIVER_REGISTER_PURPOSE,
        });

      if (
        !result.success &&
        result.cooldown
      ) {
        return res
          .status(429)
          .json({
            success:
              false,

            message:
              `Please wait ${result.secondsRemaining} seconds before requesting another OTP.`,

            retryAfter:
              result.secondsRemaining,
          });
      }

      return res
        .status(200)
        .json({
          success:
            true,

          message:
            "Registration OTP sent successfully",

          expiresIn:
            result.expiresIn,
        });
    } catch (
      error
    ) {
      console.error(
        "SEND DRIVER REGISTER OTP ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Failed to send registration OTP",
        });
    }
  };

/* =========================================================
   VERIFY DRIVER REGISTRATION OTP + CREATE DRIVER
========================================================= */

/*
  POST /api/driver-auth/verify-register-otp

  multipart/form-data

  TEXT:

  email
  otp
  name
  phone
  address
  latitude
  longitude
  vehicleNumber
  vehicleType
  vehicleModel
  licenseNumber

  FILES:

  licenseFront
  licenseBack
  rcFront
  rcBack
  insurance
  idFront
  idBack
  profilePhoto
*/

export const verifyRegisterOtp =
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
        address,
        latitude,
        longitude,
        vehicleNumber,
        vehicleType,
        vehicleModel,
        licenseNumber,
      } =
        req.body ||
        {};

      const email =
        normalizeEmail(
          req.body
            ?.email
        );

      const otp =
        validateOtpInput(
          req.body
            ?.otp
        );

      /* ===================================================
         REQUIRED TEXT FIELDS
      =================================================== */

      if (
        !name?.trim?.() ||
        !email ||
        !phone ||
        !address?.trim?.() ||
        latitude ===
          undefined ||
        longitude ===
          undefined ||
        !vehicleNumber?.trim?.() ||
        !vehicleType?.trim?.() ||
        !licenseNumber?.trim?.()
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
              "All required Driver details must be provided",
          });
      }

      /* ===================================================
         EMAIL
      =================================================== */

      if (
        !isValidEmail(
          email
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
         OTP
      =================================================== */

      if (
        !otp
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
              "Enter a valid 6-digit OTP",
          });
      }

      /* ===================================================
         NORMALIZE PROFILE
      =================================================== */

      const normalizedName =
        String(
          name
        ).trim();

      const normalizedPhone =
        normalizePhone(
          phone
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

      const normalizedVehicleModel =
        String(
          vehicleModel ||
            ""
        ).trim();

      const normalizedLicenseNumber =
        String(
          licenseNumber
        )
          .trim()
          .toUpperCase();

      /* ===================================================
         PHONE
      =================================================== */

      if (
        !isValidPhone(
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
              "Enter a valid 10-digit Indian mobile number",
          });
      }

      /* ===================================================
         LOCATION
      =================================================== */

      const location =
        validateCoordinates(
          latitude,
          longitude
        );

      if (
        !location.valid
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
              location.message,
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
         DUPLICATE EMAIL / PHONE

         Check BEFORE consuming OTP.
      =================================================== */

      const existingDriver =
        await Driver.findOne({
          $or: [
            {
              email,
            },

            {
              phone:
                normalizedPhone,
            },
          ],
        });

      if (
        existingDriver
      ) {
        await cleanupUploadedFiles(
          req.files
        );

        const emailExists =
          existingDriver.email ===
          email;

        return res
          .status(409)
          .json({
            success:
              false,

            message:
              emailExists
                ? "This email is already registered. Please sign in instead."
                : "Phone number is already registered",
          });
      }

      /* ===================================================
         VERIFY REGISTRATION OTP
      =================================================== */

      const verification =
        await verifyStoredDriverOtp({
          email,
          otp,

          purpose:
            DRIVER_REGISTER_PURPOSE,

          /*
            Do not consume yet.

            We consume only after all final duplicate
            checks pass.
          */

          consume:
            false,
        });

      if (
        !verification.valid
      ) {
        await cleanupUploadedFiles(
          req.files
        );

        return res
          .status(
            verification.status
          )
          .json({
            success:
              false,

            message:
              verification.message,
          });
      }

      /* ===================================================
         RACE-CONDITION CHECK

         Another request could potentially register the
         same email/phone while OTP verification occurred.
      =================================================== */

      const duplicateAfterVerification =
        await Driver.findOne({
          $or: [
            {
              email,
            },

            {
              phone:
                normalizedPhone,
            },
          ],
        });

      if (
        duplicateAfterVerification
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
              "Driver account already exists",
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
          /* PERSONAL */

          name:
            normalizedName,

          phone:
            normalizedPhone,

          email,

          address:
            normalizedAddress,

          /* HOME LOCATION */

          homeLocation: {
            type:
              "Point",

            coordinates: [
              location.longitude,
              location.latitude,
            ],
          },

          /* INITIAL LOCATION */

          location: {
            type:
              "Point",

            coordinates: [
              location.longitude,
              location.latitude,
            ],
          },

          lastLocation: {
            lat:
              location.latitude,

            lng:
              location.longitude,

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

          /* VEHICLE */

          vehicleNumber:
            normalizedVehicleNumber,

          vehicleType:
            normalizedVehicleType,

          vehicleModel:
            normalizedVehicleModel,

          licenseNumber:
            normalizedLicenseNumber,

          /* DOCUMENTS */

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

          /* STATUS */

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

      driver.driverId =
        `ASAN-${driver._id
          .toString()
          .slice(
            -6
          )
          .toUpperCase()}`;

      /* ===================================================
         SAVE DRIVER
      =================================================== */

      await driver.save();

      driverSaved =
        true;

      /* ===================================================
         CONSUME REGISTRATION OTP

         Driver is created successfully, therefore OTP can
         now be permanently removed.
      =================================================== */

      await Otp.deleteOne({
        email,

        purpose:
          DRIVER_REGISTER_PURPOSE,
      });

      /* ===================================================
         JWT
      =================================================== */

      const token =
        createDriverToken(
          driver
        );

      /* ===================================================
         RESPONSE
      =================================================== */

      return res
        .status(201)
        .json({
          success:
            true,

          message:
            "Driver registered successfully. Your application is pending approval.",

          token,

          tokenType:
            "Bearer",

          expiresIn:
            "7d",

          status:
            "pending",

          code:
            "DRIVER_PENDING",

          nextStep:
            "approval-pending",

          rejectionReason:
            null,

          data:
            getSafeDriver(
              driver
            ),
        });
    } catch (
      error
    ) {
      if (
        !driverSaved
      ) {
        await cleanupUploadedFiles(
          req.files
        );
      }

      console.error(
        "VERIFY DRIVER REGISTER OTP ERROR:",
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
              "Driver account already exists",
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

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Failed to register Driver",
        });
    }
  };

/* =========================================================
   SEND DRIVER LOGIN OTP
========================================================= */

export const sendLoginOtp =
  async (
    req,
    res
  ) => {
    try {
      const email =
        normalizeEmail(
          req.body
            ?.email
        );

      /* ===================================================
         EMAIL
      =================================================== */

      if (
        !email ||
        !isValidEmail(
          email
        )
      ) {
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
         DRIVER
      =================================================== */

      const driver =
        await Driver.findByEmail(
          email
        );

      if (
        !driver
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "No Driver account found with this email. Please register first.",
          });
      }

      /* ===================================================
         SEND
      =================================================== */

      const result =
        await createAndSendDriverOtp({
          email,

          purpose:
            DRIVER_LOGIN_PURPOSE,
        });

      if (
        !result.success &&
        result.cooldown
      ) {
        return res
          .status(429)
          .json({
            success:
              false,

            message:
              `Please wait ${result.secondsRemaining} seconds before requesting another OTP.`,

            retryAfter:
              result.secondsRemaining,
          });
      }

      return res
        .status(200)
        .json({
          success:
            true,

          message:
            "Login OTP sent successfully",

          expiresIn:
            result.expiresIn,
        });
    } catch (
      error
    ) {
      console.error(
        "SEND DRIVER LOGIN OTP ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Failed to send login OTP",
        });
    }
  };

/* =========================================================
   VERIFY DRIVER LOGIN OTP
========================================================= */

export const verifyLoginOtp =
  async (
    req,
    res
  ) => {
    try {
      const email =
        normalizeEmail(
          req.body
            ?.email
        );

      const otp =
        validateOtpInput(
          req.body
            ?.otp
        );

      /* ===================================================
         EMAIL
      =================================================== */

      if (
        !email ||
        !isValidEmail(
          email
        )
      ) {
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
         OTP
      =================================================== */

      if (
        !otp
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Enter a valid 6-digit OTP",
          });
      }

      /* ===================================================
         VERIFY
      =================================================== */

      const verification =
        await verifyStoredDriverOtp({
          email,
          otp,

          purpose:
            DRIVER_LOGIN_PURPOSE,

          consume:
            true,
        });

      if (
        !verification.valid
      ) {
        return res
          .status(
            verification.status
          )
          .json({
            success:
              false,

            message:
              verification.message,
          });
      }

      /* ===================================================
         CURRENT DRIVER
      =================================================== */

      const driver =
        await Driver.findByEmail(
          email
        );

      if (
        !driver
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Driver account not found",
          });
      }

      /* ===================================================
         TOKEN
      =================================================== */

      const token =
        createDriverToken(
          driver
        );

      const statusInfo =
        getDriverStatusInfo(
          driver
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
            statusInfo.message,

          token,

          tokenType:
            "Bearer",

          expiresIn:
            "7d",

          status:
            statusInfo.status,

          code:
            statusInfo.code,

          nextStep:
            statusInfo.nextStep,

          rejectionReason:
            statusInfo
              .rejectionReason ||
            null,

          data:
            getSafeDriver(
              driver
            ),
        });
    } catch (
      error
    ) {
      console.error(
        "VERIFY DRIVER LOGIN OTP ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Failed to verify login OTP",
        });
    }
  };

/* =========================================================
   GET CURRENT DRIVER
========================================================= */

export const getCurrentDriver =
  async (
    req,
    res
  ) => {
    try {
      if (
        !req.driver
      ) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Driver authentication required",
          });
      }

      const driver =
        await Driver.findById(
          req.driver._id
        );

      if (
        !driver
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Driver account not found",
          });
      }

      const statusInfo =
        getDriverStatusInfo(
          driver
        );

      return res
        .status(200)
        .json({
          success:
            true,

          status:
            statusInfo.status,

          code:
            statusInfo.code,

          nextStep:
            statusInfo.nextStep,

          rejectionReason:
            statusInfo
              .rejectionReason ||
            null,

          data:
            getSafeDriver(
              driver
            ),
        });
    } catch (
      error
    ) {
      console.error(
        "GET CURRENT DRIVER ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Failed to load Driver account",
        });
    }
  };

/* =========================================================
   DRIVER LOGOUT
========================================================= */

export const logoutDriver =
  async (
    req,
    res
  ) => {
    try {
      if (
        !req.driver
      ) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Driver authentication required",
          });
      }

      /* ===================================================
         OPTIONAL FCM TOKEN
      =================================================== */

      const fcmToken =
        typeof req.body
          ?.fcmToken ===
        "string"
          ? req.body
              .fcmToken
              .trim()
          : "";

      if (
        fcmToken
      ) {
        await Driver.findByIdAndUpdate(
          req.driver._id,

          {
            $pull: {
              fcmTokens:
                fcmToken,
            },
          }
        );
      }

      /* ===================================================
         OFFLINE
      =================================================== */

      await Driver.findByIdAndUpdate(
        req.driver._id,

        {
          $set: {
            isOnline:
              false,

            currentStatus:
              "offline",
          },
        }
      );

      return res
        .status(200)
        .json({
          success:
            true,

          message:
            "Logged out successfully",
        });
    } catch (
      error
    ) {
      console.error(
        "DRIVER LOGOUT ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Unable to logout Driver",
        });
    }
  };
