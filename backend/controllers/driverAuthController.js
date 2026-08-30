import crypto from "crypto";
import jwt from "jsonwebtoken";

import Driver from "../models/Driver.js";
import RejectedDriver from "../models/RejectedDriver.js";
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

  delete data.password;
  delete data.__v;

  return data;
};

/* =========================================================
   SAFE REJECTION DATA
========================================================= */

const getSafeRejectedDriver = (
  rejection
) => {
  if (
    !rejection
  ) {
    return null;
  }

  return {
    rejectionId:
      String(
        rejection._id
      ),

    name:
      rejection.name,

    email:
      rejection.email,

    driverId:
      rejection.originalDriverId ||
      null,

    originalDriverMongoId:
      rejection.originalDriverMongoId,

    status:
      "rejected",

    rejectionReason:
      rejection.rejectionReason,

    rejectedAt:
      rejection.rejectedAt,

    acknowledged:
      Boolean(
        rejection.acknowledged
      ),
  };
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
   CREATE REJECTION JWT

   Used when a rejected Driver verifies their email OTP after
   the original Driver document has already been deleted.
========================================================= */

const createRejectionToken = (
  rejection
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
    !rejection?._id
  ) {
    throw new Error(
      "Rejected Driver record ID is missing"
    );
  }

  return jwt.sign(
    {
      rejectionId:
        String(
          rejection._id
        ),

      originalDriverMongoId:
        String(
          rejection
            .originalDriverMongoId
        ),

      tokenType:
        "driver_rejection",
    },

    process.env.JWT_SECRET,

    {
      algorithm:
        "HS256",

      expiresIn:
        "24h",
    }
  );
};

/* =========================================================
   READ AUTHORIZATION TOKEN
========================================================= */

const getAuthorizationToken = (
  req
) => {
  const authorization =
    String(
      req.headers
        ?.authorization ||
        ""
    ).trim();

  if (
    !authorization
  ) {
    return null;
  }

  const [
    scheme,
    token,
  ] =
    authorization.split(
      " "
    );

  if (
    String(
      scheme
    ).toLowerCase() !==
      "bearer" ||
    !token
  ) {
    return null;
  }

  return token.trim();
};

/* =========================================================
   VERIFY REJECTION ACCESS TOKEN

   IMPORTANT:
   This verifies the JWT directly.

   It does NOT require the Driver document to still exist,
   because rejected Driver documents are deleted.
========================================================= */

const verifyRejectionAccessToken = (
  req
) => {
  const token =
    getAuthorizationToken(
      req
    );

  if (
    !token
  ) {
    return {
      valid:
        false,

      status:
        401,

      message:
        "Driver authentication required",
    };
  }

  if (
    !process.env
      .JWT_SECRET
  ) {
    return {
      valid:
        false,

      status:
        500,

      message:
        "JWT configuration is missing",
    };
  }

  try {
    const decoded =
      jwt.verify(
        token,

        process.env.JWT_SECRET,

        {
          algorithms: [
            "HS256",
          ],
        }
      );

    if (
      ![
        "driver",
        "driver_rejection",
      ].includes(
        decoded?.tokenType
      )
    ) {
      return {
        valid:
          false,

        status:
          401,

        message:
          "Invalid Driver authentication token",
      };
    }

    return {
      valid:
        true,

      decoded,
    };
  } catch (
    error
  ) {
    return {
      valid:
        false,

      status:
        401,

      message:
        error?.name ===
        "TokenExpiredError"
          ? "Driver session has expired"
          : "Invalid Driver authentication token",
    };
  }
};

/* =========================================================
   FIND REJECTION FROM TOKEN
========================================================= */

const findRejectionFromToken =
  async (
    decoded
  ) => {
    if (
      decoded
        ?.tokenType ===
      "driver_rejection"
    ) {
      if (
        !decoded
          ?.rejectionId
      ) {
        return null;
      }

      return RejectedDriver.findOne({
        _id:
          decoded
            .rejectionId,

        active:
          true,

        acknowledged:
          false,
      });
    }

    if (
      decoded
        ?.tokenType ===
      "driver"
    ) {
      if (
        !decoded?.id
      ) {
        return null;
      }

      return RejectedDriver.findOne({
        originalDriverMongoId:
          String(
            decoded.id
          ),

        active:
          true,

        acknowledged:
          false,
      }).sort({
        rejectedAt:
          -1,
      });
    }

    return null;
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

  /*
    Legacy support only.

    New rejected Drivers should normally live inside
    RejectedDriver rather than Driver.
  */

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
         ACTIVE REJECTION

         The Driver must see/acknowledge their previous
         rejection before registering again.
      =================================================== */

      const activeRejection =
        await RejectedDriver
          .findActiveByEmail(
            email
          );

      if (
        activeRejection
      ) {
        return res
          .status(409)
          .json({
            success:
              false,

            status:
              "rejected",

            code:
              "DRIVER_REJECTED",

            nextStep:
              "application-rejected",

            message:
              "Your previous Driver application was rejected. Please review the rejection before registering again.",
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
         ACTIVE REJECTION
      =================================================== */

      const activeRejection =
        await RejectedDriver
          .findActiveByEmail(
            email
          );

      if (
        activeRejection
      ) {
        await cleanupUploadedFiles(
          req.files
        );

        return res
          .status(409)
          .json({
            success:
              false,

            status:
              "rejected",

            code:
              "DRIVER_REJECTED",

            nextStep:
              "application-rejected",

            message:
              "Your previous Driver application must be acknowledged before registering again.",
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
         RACE CONDITION CHECK
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
          name:
            normalizedName,

          phone:
            normalizedPhone,

          email,

          address:
            normalizedAddress,

          homeLocation: {
            type:
              "Point",

            coordinates: [
              location.longitude,
              location.latitude,
            ],
          },

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

          vehicleNumber:
            normalizedVehicleNumber,

          vehicleType:
            normalizedVehicleType,

          vehicleModel:
            normalizedVehicleModel,

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
        const activeRejection =
          await RejectedDriver
            .findActiveByEmail(
              email
            );

        if (
          activeRejection
        ) {
          /*
            We deliberately do not expose the rejection reason
            here because this endpoint has not verified that
            the caller owns the email address.
          */

          return res
            .status(409)
            .json({
              success:
                false,

              status:
                "rejected",

              code:
                "DRIVER_REJECTED",

              nextStep:
                "application-rejected",

              message:
                "This Driver application has been rejected. Please review the application status from your existing session.",
            });
        }

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

      /* ===================================================
         DRIVER WAS REJECTED AFTER OTP REQUEST
      =================================================== */

      if (
        !driver
      ) {
        const rejection =
          await RejectedDriver
            .findActiveByEmail(
              email
            );

        if (
          rejection
        ) {
          const rejectionToken =
            createRejectionToken(
              rejection
            );

          return res
            .status(200)
            .json({
              success:
                true,

              message:
                "Your Driver application was rejected",

              status:
                "rejected",

              code:
                "DRIVER_REJECTED",

              nextStep:
                "application-rejected",

              rejectionReason:
                rejection
                  .rejectionReason,

              rejectedAt:
                rejection
                  .rejectedAt,

              token:
                rejectionToken,

              tokenType:
                "Bearer",

              expiresIn:
                "24h",

              data:
                getSafeRejectedDriver(
                  rejection
                ),
            });
        }

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
   GET REJECTED APPLICATION STATUS

   This endpoint intentionally verifies the JWT internally.

   Do NOT place normal verifyDriver middleware in front of
   this route because the original Driver record is deleted
   after rejection.
========================================================= */

export const getRejectedApplicationStatus =
  async (
    req,
    res
  ) => {
    try {
      const verification =
        verifyRejectionAccessToken(
          req
        );

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

      const rejection =
        await findRejectionFromToken(
          verification.decoded
        );

      if (
        !rejection
      ) {
        /*
          If the token belongs to a real Driver that still
          exists, this simply means the Driver has not been
          rejected.
        */

        if (
          verification
            .decoded
            ?.tokenType ===
            "driver" &&
          verification
            .decoded
            ?.id
        ) {
          const driver =
            await Driver.findById(
              verification
                .decoded
                .id
            );

          if (
            driver
          ) {
            const statusInfo =
              getDriverStatusInfo(
                driver
              );

            return res
              .status(200)
              .json({
                success:
                  true,

                rejected:
                  false,

                status:
                  statusInfo.status,

                code:
                  statusInfo.code,

                nextStep:
                  statusInfo.nextStep,

                rejectionReason:
                  null,
              });
          }
        }

        return res
          .status(404)
          .json({
            success:
              false,

            rejected:
              false,

            message:
              "No active Driver rejection was found",
          });
      }

      return res
        .status(200)
        .json({
          success:
            true,

          rejected:
            true,

          status:
            "rejected",

          code:
            "DRIVER_REJECTED",

          nextStep:
            "application-rejected",

          message:
            "Your Driver application was rejected",

          rejectionReason:
            rejection
              .rejectionReason,

          rejectedAt:
            rejection
              .rejectedAt,

          data:
            getSafeRejectedDriver(
              rejection
            ),
        });
    } catch (
      error
    ) {
      console.error(
        "GET DRIVER REJECTION STATUS ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Failed to load Driver rejection status",
        });
    }
  };

/* =========================================================
   ACKNOWLEDGE REJECTED APPLICATION

   Called only after the Driver has seen the rejection screen
   and chooses to return to Sign In.
========================================================= */

export const acknowledgeRejectedApplication =
  async (
    req,
    res
  ) => {
    try {
      const verification =
        verifyRejectionAccessToken(
          req
        );

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

      const rejection =
        await findRejectionFromToken(
          verification.decoded
        );

      if (
        !rejection
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "No active Driver rejection was found",
          });
      }

      /* ===================================================
         ACKNOWLEDGE
      =================================================== */

      rejection.acknowledged =
        true;

      rejection.acknowledgedAt =
        new Date();

      rejection.active =
        false;

      await rejection.save();

      /* ===================================================
         REMOVE OLD OTP RECORDS
      =================================================== */

      await Otp.deleteMany({
        email:
          rejection.email,

        purpose: {
          $in: [
            DRIVER_LOGIN_PURPOSE,
            DRIVER_REGISTER_PURPOSE,
          ],
        },
      });

      return res
        .status(200)
        .json({
          success:
            true,

          message:
            "Driver rejection acknowledged successfully",

          acknowledged:
            true,

          nextStep:
            "signin",
        });
    } catch (
      error
    ) {
      console.error(
        "ACKNOWLEDGE DRIVER REJECTION ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Failed to acknowledge Driver rejection",
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
