import mongoose from "mongoose";

/* =========================================================
   BILLING SETTINGS SCHEMA
========================================================= */

const billingSettingsSchema =
  new mongoose.Schema(
    {
      /* =====================================================
         RATE PER KM
      ===================================================== */

      ratePerKm: {
        type: Number,
        required: true,
        default: 3,
        min: 0,
      },

      /* =====================================================
         PLATFORM COMMISSION
      ===================================================== */

      /*
        Stored as percentage.

        Example:

        2 = 2%
        10 = 10%
      */

      platformCommission: {
        type: Number,
        required: true,
        default: 2,
        min: 0,
        max: 100,
      },

      /* =====================================================
         BILLING TYPE
      ===================================================== */

      billingType: {
        type: String,

        enum: [
          "postpaid",
          "prepaid",
        ],

        default: "postpaid",
      },

      /* =====================================================
         MINIMUM FARE
      ===================================================== */

      minimumFare: {
        type: Number,
        default: 50,
        min: 0,
      },

      /* =====================================================
         PAYMENT DUE DAYS
      ===================================================== */

      paymentDueDays: {
        type: Number,
        default: 5,
        min: 1,
      },

      /* =====================================================
         ACTIVE SETTINGS
      ===================================================== */

      isActive: {
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
   STATIC — GET ACTIVE SETTINGS
========================================================= */

billingSettingsSchema.statics.getActive =
  function () {
    return this.findOne({
      isActive: true,
    }).sort({
      updatedAt: -1,
    });
  };

/* =========================================================
   JSON TRANSFORM
========================================================= */

billingSettingsSchema.set(
  "toJSON",
  {
    virtuals: true,

    transform: function (
      doc,
      ret
    ) {
      delete ret.__v;

      return ret;
    },
  }
);

/* =========================================================
   OBJECT TRANSFORM
========================================================= */

billingSettingsSchema.set(
  "toObject",
  {
    virtuals: true,

    transform: function (
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

const BillingSettings =
  mongoose.models
    .BillingSettings ||
  mongoose.model(
    "BillingSettings",
    billingSettingsSchema
  );

export default BillingSettings;
