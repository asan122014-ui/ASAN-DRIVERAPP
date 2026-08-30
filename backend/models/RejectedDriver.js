import mongoose from "mongoose";

/* =========================================================
   REJECTED DRIVER SCHEMA

   PURPOSE:

   This collection stores only the minimum information
   required after a Driver application is rejected.

   The original Driver document can then be removed from
   the Driver collection while still allowing the Driver
   app to show the rejection result and reason.

   IMPORTANT:

   Do NOT store:
   - Driver documents
   - License images
   - RC images
   - Insurance
   - ID proof images
   - Live location
   - Home location
   - FCM tokens
   - Trip information
========================================================= */

const rejectedDriverSchema =
  new mongoose.Schema(
    {
      /* =====================================================
         DRIVER NAME
      ===================================================== */

      name: {
        type: String,

        required: true,

        trim: true,

        maxlength: [
          100,
          "Driver name is too long",
        ],
      },

      /* =====================================================
         EMAIL

         Used to identify the rejected applicant when the
         Driver app checks the application status.
      ===================================================== */

      email: {
        type: String,

        required: true,

        trim: true,

        lowercase: true,

        index: true,

        set(value) {
          return String(
            value || ""
          )
            .trim()
            .toLowerCase();
        },

        validate: {
          validator(
            value
          ) {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
              value
            );
          },

          message:
            "Enter a valid email address",
        },
      },

      /* =====================================================
         PHONE

         Stored only as a secondary reference.
      ===================================================== */

      phone: {
        type: String,

        default: "",

        trim: true,

        set(value) {
          return String(
            value || ""
          ).replace(
            /\D/g,
            ""
          );
        },
      },

      /* =====================================================
         ORIGINAL MONGODB DRIVER ID

         Stored as String because the original Driver
         document will eventually be deleted.
      ===================================================== */

      originalDriverMongoId: {
        type: String,

        required: true,

        trim: true,

        index: true,
      },

      /* =====================================================
         PUBLIC ASAN DRIVER ID
      ===================================================== */

      originalDriverId: {
        type: String,

        default: null,

        trim: true,

        uppercase: true,

        index: true,

        set(value) {
          if (
            value === null ||
            value === undefined ||
            String(
              value
            ).trim() === ""
          ) {
            return null;
          }

          return String(
            value
          )
            .trim()
            .toUpperCase();
        },
      },

      /* =====================================================
         REJECTION REASON
      ===================================================== */

      rejectionReason: {
        type: String,

        required: true,

        trim: true,

        minlength: [
          5,
          "Rejection reason must contain at least 5 characters",
        ],

        maxlength: [
          500,
          "Rejection reason must not exceed 500 characters",
        ],
      },

      /* =====================================================
         REJECTED AT
      ===================================================== */

      rejectedAt: {
        type: Date,

        required: true,

        default:
          Date.now,

        index: true,
      },

      /* =====================================================
         REVIEWED BY

         Reference to the Admin who rejected the Driver.
      ===================================================== */

      reviewedBy: {
        type:
          mongoose.Schema.Types
            .ObjectId,

        ref:
          "Admin",

        required: true,

        index: true,
      },

      /* =====================================================
         EMAIL DELIVERY STATUS

         We only delete the original Driver after the
         rejection email has been successfully sent.
      ===================================================== */

      emailSent: {
        type: Boolean,

        default: false,

        index: true,
      },

      emailSentAt: {
        type: Date,

        default: null,
      },

      /* =====================================================
         DRIVER HAS SEEN REJECTION SCREEN

         false:
           Driver has not yet acknowledged the rejection.

         true:
           Driver has seen the rejection page and selected
           the action to return to Sign In.
      ===================================================== */

      acknowledged: {
        type: Boolean,

        default: false,

        index: true,
      },

      acknowledgedAt: {
        type: Date,

        default: null,
      },

      /* =====================================================
         REJECTION RECORD ACTIVE

         active = true:
           Driver app should still be able to retrieve the
           rejection result.

         active = false:
           Rejection has already been acknowledged.

         Keeping this separate from "acknowledged" gives us
         flexibility for cleanup later.
      ===================================================== */

      active: {
        type: Boolean,

        default: true,

        index: true,
      },
    },

    {
      timestamps: true,

      toJSON: {
        virtuals: true,
      },

      toObject: {
        virtuals: true,
      },
    }
  );

/* =========================================================
   INDEXES
========================================================= */

/*
  Usually only the latest active rejection for an email
  matters to the Driver app.
*/

rejectedDriverSchema.index({
  email: 1,

  active: 1,

  rejectedAt: -1,
});

/*
  Useful for Admin audit/debugging.
*/

rejectedDriverSchema.index({
  reviewedBy: 1,

  rejectedAt: -1,
});

/*
  Useful when looking up the rejection using the old
  Driver MongoDB ID.
*/

rejectedDriverSchema.index({
  originalDriverMongoId: 1,

  rejectedAt: -1,
});

/* =========================================================
   STATIC — FIND ACTIVE REJECTION BY EMAIL
========================================================= */

rejectedDriverSchema.statics.findActiveByEmail =
  function (
    email
  ) {
    const normalizedEmail =
      String(
        email || ""
      )
        .trim()
        .toLowerCase();

    if (
      !normalizedEmail
    ) {
      return null;
    }

    return this.findOne({
      email:
        normalizedEmail,

      active:
        true,

      acknowledged:
        false,
    }).sort({
      rejectedAt:
        -1,
    });
  };

/* =========================================================
   STATIC — FIND LATEST REJECTION BY EMAIL
========================================================= */

rejectedDriverSchema.statics.findLatestByEmail =
  function (
    email
  ) {
    const normalizedEmail =
      String(
        email || ""
      )
        .trim()
        .toLowerCase();

    if (
      !normalizedEmail
    ) {
      return null;
    }

    return this.findOne({
      email:
        normalizedEmail,
    }).sort({
      rejectedAt:
        -1,
    });
  };

/* =========================================================
   ACKNOWLEDGE REJECTION
========================================================= */

rejectedDriverSchema.methods.acknowledge =
  async function () {
    if (
      this.acknowledged
    ) {
      return this;
    }

    this.acknowledged =
      true;

    this.acknowledgedAt =
      new Date();

    this.active =
      false;

    await this.save();

    return this;
  };

/* =========================================================
   MARK EMAIL SENT
========================================================= */

rejectedDriverSchema.methods.markEmailSent =
  async function () {
    this.emailSent =
      true;

    this.emailSentAt =
      new Date();

    await this.save();

    return this;
  };

/* =========================================================
   JSON CLEANUP
========================================================= */

rejectedDriverSchema.set(
  "toJSON",
  {
    virtuals: true,

    transform(
      doc,
      ret
    ) {
      delete ret.__v;

      return ret;
    },
  }
);

/* =========================================================
   OBJECT CLEANUP
========================================================= */

rejectedDriverSchema.set(
  "toObject",
  {
    virtuals: true,

    transform(
      doc,
      ret
    ) {
      delete ret.__v;

      return ret;
    },
  }
);

/* =========================================================
   MODEL
========================================================= */

const RejectedDriver =
  mongoose.models
    .RejectedDriver ||
  mongoose.model(
    "RejectedDriver",
    rejectedDriverSchema
  );

export default RejectedDriver;
