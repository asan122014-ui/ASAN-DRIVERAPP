import mongoose from "mongoose";

/* =========================================================
   EMAIL OTP SCHEMA
========================================================= */

const otpSchema =
  new mongoose.Schema(
    {
      /* =====================================================
         EMAIL
      ===================================================== */

      email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        index: true,
      },

      /* =====================================================
         OTP HASH

         Never store the actual OTP.

         Store only the SHA-256 hash.
      ===================================================== */

      otpHash: {
        type: String,
        required: true,
      },

      /* =====================================================
         PURPOSE

         Keeps OTP flows isolated.

         Parent:
           login
           register

         Driver:
           driver_login
      ===================================================== */

      purpose: {
        type: String,

        enum: [
          "login",
          "register",
          "driver_login",
        ],

        required: true,
        index: true,
      },

      /* =====================================================
         EXPIRATION
      ===================================================== */

      expiresAt: {
        type: Date,
        required: true,
        index: true,
      },

      /* =====================================================
         FAILED ATTEMPTS
      ===================================================== */

      attempts: {
        type: Number,
        default: 0,
        min: 0,
      },

      /* =====================================================
         MAXIMUM ATTEMPTS

         After this many incorrect OTP attempts,
         the OTP becomes unusable.
      ===================================================== */

      maxAttempts: {
        type: Number,
        default: 5,
        min: 1,
      },

      /* =====================================================
         USED

         OTP becomes unusable after successful verification.
      ===================================================== */

      used: {
        type: Boolean,
        default: false,
        index: true,
      },

      /* =====================================================
         RESEND COUNT
      ===================================================== */

      resendCount: {
        type: Number,
        default: 0,
        min: 0,
      },

      /* =====================================================
         LAST SENT AT

         Used for resend cooldown.
      ===================================================== */

      lastSentAt: {
        type: Date,
        default: Date.now,
      },
    },

    {
      timestamps: true,
    }
  );

/* =========================================================
   UNIQUE OTP KEY

   Only one OTP document should exist for:

   email + purpose

   Example:

   parent@gmail.com + login
   parent@gmail.com + register
   driver@gmail.com + driver_login

   These remain separate.
========================================================= */

otpSchema.index(
  {
    email: 1,
    purpose: 1,
  },

  {
    unique: true,
  }
);

/* =========================================================
   TTL INDEX

   MongoDB removes expired OTP documents automatically.

   Important:
   TTL cleanup is not instantaneous, so controller code
   must still check expiresAt before accepting an OTP.
========================================================= */

otpSchema.index(
  {
    expiresAt: 1,
  },

  {
    expireAfterSeconds: 0,
  }
);

/* =========================================================
   NORMALIZE EMAIL
========================================================= */

otpSchema.statics.normalizeEmail =
  function (
    email
  ) {
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
   FIND ACTIVE OTP
========================================================= */

otpSchema.statics.findActiveOtp =
  function (
    email,
    purpose
  ) {
    const normalizedEmail =
      this.normalizeEmail(
        email
      );

    if (
      !normalizedEmail ||
      !purpose
    ) {
      return null;
    }

    return this.findOne({
      email:
        normalizedEmail,

      purpose,

      used:
        false,

      expiresAt: {
        $gt:
          new Date(),
      },
    });
  };

/* =========================================================
   MODEL
========================================================= */

const Otp =
  mongoose.models.Otp ||
  mongoose.model(
    "Otp",
    otpSchema
  );

export default Otp;
