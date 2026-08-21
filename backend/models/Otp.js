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

         Prevents a registration OTP from being
         used for login and vice versa.
      ===================================================== */

      purpose: {
        type: String,
        enum: [
          "login",
          "register",
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

         After this many wrong OTP entries,
         the OTP must no longer be accepted.
      ===================================================== */

      maxAttempts: {
        type: Number,
        default: 5,
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

         Useful for resend cooldown.
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
   UNIQUE ACTIVE OTP KEY

   Only one OTP document should exist for:

   email + purpose

   When sending a new OTP, update/replace the
   existing record rather than creating many.
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

   MongoDB automatically removes expired OTP
   documents after expiresAt is reached.

   expireAfterSeconds: 0 means expiresAt itself
   controls the deletion time.
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
