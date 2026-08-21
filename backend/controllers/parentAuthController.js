import crypto from "crypto";
import jwt from "jsonwebtoken";

import Parent from "../models/Parent.js";
import Otp from "../models/Otp.js";

import {
  sendParentOtpEmail,
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

/* =========================================================
   EMAIL NORMALIZATION
========================================================= */

const normalizeEmail = (
  email
) => {
  if (!email) {
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
   PHONE NORMALIZATION
========================================================= */

/*
Phone is NOT used for authentication anymore.

It remains Parent contact/profile information.
*/

const normalizePhone = (
  phone
) => {
  if (!phone) {
    return null;
  }

  const value =
    String(
      phone
    )
      .trim()
      .replace(
        /[\s()-]/g,
        ""
      );

  /* =====================================================
     ALREADY E.164
  ===================================================== */

  if (
    /^\+\d{8,15}$/.test(
      value
    )
  ) {
    return value;
  }

  /* =====================================================
     INDIAN 10-DIGIT NUMBER
  ===================================================== */

  if (
    /^[6-9]\d{9}$/.test(
      value
    )
  ) {
    return `+91${value}`;
  }

  /* =====================================================
     INDIA WITH COUNTRY CODE
  ===================================================== */

  if (
    /^91[6-9]\d{9}$/.test(
      value
    )
  ) {
    return `+${value}`;
  }

  return null;
};

/* =========================================================
   LOCATION VALIDATION
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
      valid: false,

      message:
        "Valid latitude and longitude are required",
    };
  }

  if (
    lat < -90 ||
    lat > 90
  ) {
    return {
      valid: false,

      message:
        "Latitude must be between -90 and 90",
    };
  }

  if (
    lng < -180 ||
    lng > 180
  ) {
    return {
      valid: false,

      message:
        "Longitude must be between -180 and 180",
    };
  }

  return {
    valid: true,

    latitude:
      lat,

    longitude:
      lng,
  };
};

/* =========================================================
   GENERATE OTP
========================================================= */

const generateOtp = () => {
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
   SAFE PARENT
========================================================= */

const getSafeParent = (
  parent
) => {
  if (!parent) {
    return null;
  }

  const data =
    typeof parent.toJSON ===
    "function"
      ? parent.toJSON()
      : { ...parent };

  delete data.password;
  delete data.firebaseUid;
  delete data.__v;

  return data;
};

/* =========================================================
   CREATE PARENT JWT
========================================================= */

const createParentToken = (
  parent
) => {
  if (
    !process.env.JWT_SECRET
  ) {
    throw new Error(
      "JWT_SECRET is not configured"
    );
  }

  return jwt.sign(
    {
      id:
        String(
          parent._id
        ),

      tokenType:
        "parent",
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
   AUTHENTICATED RESPONSE
========================================================= */

const sendAuthenticatedParent = (
  res,
  parent,
  statusCode = 200,
  message = "Authentication successful"
) => {
  const token =
    createParentToken(
      parent
    );

  return res
    .status(
      statusCode
    )
    .json({
      success: true,

      message,

      token,

      data:
        getSafeParent(
          parent
        ),
    });
};

/* =========================================================
   OTP VALIDATION
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
   SEND OTP
========================================================= */

const createAndSendOtp =
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
          existingOtp.lastSentAt
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
          success: false,

          cooldown:
            true,

          secondsRemaining,
        };
      }
    }

    /* =====================================================
       GENERATE
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
       STORE HASHED OTP
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
       SEND THROUGH RESEND
    ===================================================== */

    try {
      await sendParentOtpEmail({
        email,
        otp,
        purpose,
      });
    } catch (
      error
    ) {
      /*
        If Resend fails, remove the OTP so
        an unsent code cannot remain valid.
      */

      await Otp.deleteOne({
        email,
        purpose,
        otpHash,
      });

      throw error;
    }

    return {
      success: true,

      expiresIn:
        OTP_EXPIRY_MINUTES *
        60,
    };
  };

/* =========================================================
   VERIFY OTP
========================================================= */

const verifyStoredOtp =
  async ({
    email,
    otp,
    purpose,
  }) => {
    const storedOtp =
      await Otp.findOne({
        email,
        purpose,
        used:
          false,
      });

    /* =====================================================
       OTP NOT FOUND
    ===================================================== */

    if (
      !storedOtp
    ) {
      return {
        valid: false,

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
      storedOtp.expiresAt
        .getTime() <=
        Date.now()
    ) {
      await Otp.deleteOne({
        _id:
          storedOtp._id,
      });

      return {
        valid: false,

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
        valid: false,

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

    if (!valid) {
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
          valid: false,

          status:
            429,

          message:
            "Too many incorrect attempts. Please request a new OTP.",
        };
      }

      return {
        valid: false,

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
       OTP VERIFIED

       Delete immediately so it can never
       be replayed.
    ===================================================== */

    await Otp.deleteOne({
      _id:
        storedOtp._id,
    });

    return {
      valid: true,
    };
  };

/* =========================================================
   SEND LOGIN OTP
========================================================= */

/*
POST /api/parent-auth/send-login-otp

{
  "email": "parent@gmail.com"
}
*/

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
         EXISTING PARENT
      =================================================== */

      const parent =
        await Parent.findByEmail(
          email
        );

      if (!parent) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "No Parent account found with this email. Please register first.",
          });
      }

      /* ===================================================
         ACTIVE ACCOUNT
      =================================================== */

      if (
        parent.isActive ===
        false
      ) {
        return res
          .status(403)
          .json({
            success:
              false,

            message:
              "Parent account is inactive",
          });
      }

      /* ===================================================
         SEND OTP
      =================================================== */

      const result =
        await createAndSendOtp({
          email,

          purpose:
            "login",
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
        "SEND LOGIN OTP ERROR:",
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
   VERIFY LOGIN OTP
========================================================= */

/*
POST /api/parent-auth/verify-login-otp

{
  "email": "parent@gmail.com",
  "otp": "123456"
}
*/

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
          req.body?.otp
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

      if (!otp) {
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
        await verifyStoredOtp({
          email,
          otp,

          purpose:
            "login",
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
         FETCH PARENT AGAIN

         Important because account state could
         change after OTP was sent.
      =================================================== */

      const parent =
        await Parent.findByEmail(
          email
        );

      if (!parent) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Parent account not found",
          });
      }

      if (
        parent.isActive ===
        false
      ) {
        return res
          .status(403)
          .json({
            success:
              false,

            message:
              "Parent account is inactive",
          });
      }

      return sendAuthenticatedParent(
        res,
        parent,
        200,
        "Login successful"
      );
    } catch (
      error
    ) {
      console.error(
        "VERIFY LOGIN OTP ERROR:",
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
   SEND REGISTER OTP
========================================================= */

/*
POST /api/parent-auth/send-register-otp

{
  "email": "parent@gmail.com"
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
         EMAIL ALREADY REGISTERED
      =================================================== */

      const existingParent =
        await Parent.findByEmail(
          email
        );

      if (
        existingParent
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
        await createAndSendOtp({
          email,

          purpose:
            "register",
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
        "SEND REGISTER OTP ERROR:",
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
   VERIFY REGISTER OTP + CREATE PARENT
========================================================= */

/*
POST /api/parent-auth/verify-register-otp

{
  "email": "parent@gmail.com",
  "otp": "123456",
  "name": "Parent Name",
  "phone": "8309649713",
  "address": "Hyderabad",
  "latitude": 17.385,
  "longitude": 78.486
}
*/

export const verifyRegisterOtp =
  async (
    req,
    res
  ) => {
    try {
      const {
        name,
        phone,
        address,
        latitude,
        longitude,
      } =
        req.body || {};

      const email =
        normalizeEmail(
          req.body
            ?.email
        );

      const otp =
        validateOtpInput(
          req.body?.otp
        );

      /* ===================================================
         REQUIRED FIELDS
      =================================================== */

      if (
        !name?.trim?.() ||
        !email ||
        !phone ||
        !address?.trim?.() ||
        latitude ===
          undefined ||
        longitude ===
          undefined
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Name, email, phone, address, latitude and longitude are required",
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

      if (!otp) {
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

      if (
        !normalizedPhone
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Enter a valid phone number",
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
         CHECK EMAIL BEFORE OTP CONSUMPTION
      =================================================== */

      const existingEmail =
        await Parent.findByEmail(
          email
        );

      if (
        existingEmail
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
         CHECK PHONE
      =================================================== */

      const existingPhone =
        await Parent.findByPhone(
          normalizedPhone
        );

      if (
        existingPhone
      ) {
        return res
          .status(409)
          .json({
            success:
              false,

            message:
              "Phone number is already registered",
          });
      }

      /* ===================================================
         VERIFY EMAIL OTP
      =================================================== */

      const verification =
        await verifyStoredOtp({
          email,
          otp,

          purpose:
            "register",
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
         RACE-CONDITION CHECKS

         Re-check after OTP verification in case
         another request created an account.
      =================================================== */

      const [
        emailAfterVerification,
        phoneAfterVerification,
      ] =
        await Promise.all([
          Parent.findByEmail(
            email
          ),

          Parent.findByPhone(
            normalizedPhone
          ),
        ]);

      if (
        emailAfterVerification
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

      if (
        phoneAfterVerification
      ) {
        return res
          .status(409)
          .json({
            success:
              false,

            message:
              "Phone number is already registered",
          });
      }

      /* ===================================================
         CREATE PARENT
      =================================================== */

      const parent =
        await Parent.create({
          name:
            normalizedName,

          email,

          phone:
            normalizedPhone,

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

          isActive:
            true,
        });

      /* ===================================================
         JWT
      =================================================== */

      return sendAuthenticatedParent(
        res,
        parent,
        201,
        "Parent registered successfully"
      );
    } catch (
      error
    ) {
      console.error(
        "VERIFY REGISTER OTP ERROR:",
        error
      );

      /* ===================================================
         DUPLICATE
      =================================================== */

      if (
        error?.code ===
        11000
      ) {
        const duplicateField =
          Object.keys(
            error.keyPattern ||
              {}
          )[0];

        if (
          duplicateField ===
          "email"
        ) {
          return res
            .status(409)
            .json({
              success:
                false,

              message:
                "Email is already registered",
            });
        }

        if (
          duplicateField ===
          "phone"
        ) {
          return res
            .status(409)
            .json({
              success:
                false,

              message:
                "Phone number is already registered",
            });
        }

        return res
          .status(409)
          .json({
            success:
              false,

            message:
              "Parent account already exists",
          });
      }

      /* ===================================================
         VALIDATION
      =================================================== */

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
            "Failed to register Parent",
        });
    }
  };
