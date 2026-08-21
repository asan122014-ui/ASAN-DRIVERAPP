import crypto from "crypto";
import jwt from "jsonwebtoken";

import Driver from "../models/Driver.js";
import Otp from "../models/Otp.js";

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

/* =========================================================
   EMAIL NORMALIZATION
========================================================= */

const normalizeEmail = (
  email
) => {
  if (
    !email
  ) {
    return "";
  }

  return String(
    email
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
   SAFE HASH COMPARISON
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
   OTP INPUT VALIDATION
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
    Password is no longer part of the Driver schema.

    This delete is retained temporarily so old MongoDB
    documents containing a legacy password can never
    accidentally expose it.
  */

  delete data.password;
  delete data.__v;

  return data;
};

/* =========================================================
   CREATE DRIVER JWT
========================================================= */

/*
  Driver JWT:

  {
    id: "<MongoDB Driver _id>",
    tokenType: "driver"
  }
*/

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
  /* =====================================================
     APPROVED
  ===================================================== */

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

  /* =====================================================
     PENDING
  ===================================================== */

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

  /* =====================================================
     REJECTED
  ===================================================== */

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
        driver.rejectionReason ||
        null,
    };
  }

  /* =====================================================
     UNKNOWN
  ===================================================== */

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
   CREATE AND SEND DRIVER OTP
========================================================= */

const createAndSendDriverOtp =
  async ({
    email,
  }) => {
    /* =====================================================
       EXISTING OTP
    ===================================================== */

    const existingOtp =
      await Otp.findOne({
        email,

        purpose:
          DRIVER_LOGIN_PURPOSE,
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
       STORE OTP HASH
    ===================================================== */

    await Otp.findOneAndUpdate(
      {
        email,

        purpose:
          DRIVER_LOGIN_PURPOSE,
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

          purpose:
            DRIVER_LOGIN_PURPOSE,
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
       SEND EMAIL
    ===================================================== */

    try {
      await sendDriverOtpEmail({
        email,
        otp,
        purpose:
          "login",
      });
    } catch (
      error
    ) {
      /*
        If sending fails, remove the OTP so an
        unsent OTP can never remain usable.
      */

      await Otp.deleteOne({
        email,

        purpose:
          DRIVER_LOGIN_PURPOSE,

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
   VERIFY STORED DRIVER OTP
========================================================= */

const verifyStoredDriverOtp =
  async ({
    email,
    otp,
  }) => {
    /* =====================================================
       FIND OTP
    ===================================================== */

    const storedOtp =
      await Otp.findOne({
        email,

        purpose:
          DRIVER_LOGIN_PURPOSE,

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
       EXPIRATION
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
       ATTEMPT LIMIT
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
       COMPARE OTP
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
       VERIFIED — CONSUME OTP
    ===================================================== */

    /*
      Delete immediately.

      The OTP cannot be replayed after successful
      authentication.
    */

    await Otp.deleteOne({
      _id:
        storedOtp._id,
    });

    return {
      valid:
        true,
    };
  };

/* =========================================================
   SEND DRIVER LOGIN OTP
========================================================= */

/*
  POST /api/driver-auth/send-login-otp

  BODY:

  {
    "email": "driver@example.com"
  }
*/

export const sendLoginOtp =
  async (
    req,
    res
  ) => {
    try {
      /* ===================================================
         EMAIL
      =================================================== */

      const email =
        normalizeEmail(
          req.body
            ?.email
        );

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
         DRIVER ACCOUNT
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
         SEND OTP
      =================================================== */

      const result =
        await createAndSendDriverOtp({
          email,
        });

      /* ===================================================
         COOLDOWN
      =================================================== */

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

      /* ===================================================
         RESPONSE
      =================================================== */

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

/*
  POST /api/driver-auth/verify-login-otp

  BODY:

  {
    "email": "driver@example.com",
    "otp": "123456"
  }
*/

export const verifyLoginOtp =
  async (
    req,
    res
  ) => {
    try {
      /* ===================================================
         EMAIL
      =================================================== */

      const email =
        normalizeEmail(
          req.body
            ?.email
        );

      /* ===================================================
         OTP
      =================================================== */

      const otp =
        validateOtpInput(
          req.body
            ?.otp
        );

      /* ===================================================
         EMAIL VALIDATION
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
         OTP VALIDATION
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
         VERIFY OTP
      =================================================== */

      const verification =
        await verifyStoredDriverOtp({
          email,
          otp,
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
         FETCH DRIVER AGAIN
      =================================================== */

      /*
        We fetch the Driver again after OTP verification.

        This ensures that approval/rejection state is
        always current even if Admin changed it while
        the OTP was being entered.
      */

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
         JWT
      =================================================== */

      const token =
        createDriverToken(
          driver
        );

      /* ===================================================
         STATUS
      =================================================== */

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

/*
  GET /api/driver-auth/me

  HEADER:

  Authorization: Bearer <DRIVER_JWT>
*/

export const getCurrentDriver =
  async (
    req,
    res
  ) => {
    try {
      /* ===================================================
         AUTHENTICATED DRIVER
      =================================================== */

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
         CURRENT DATABASE STATE
      =================================================== */

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

      /* ===================================================
         RESPONSE
      =================================================== */

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

/*
  POST /api/driver-auth/logout

  HEADER:

  Authorization: Bearer <DRIVER_JWT>

  OPTIONAL BODY:

  {
    "fcmToken": "..."
  }

  JWT is stateless.

  Frontend must delete the JWT locally after logout.
*/

export const logoutDriver =
  async (
    req,
    res
  ) => {
    try {
      /* ===================================================
         AUTHENTICATION
      =================================================== */

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
         FCM TOKEN
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
         OFFLINE STATUS
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

      /* ===================================================
         RESPONSE
      =================================================== */

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
