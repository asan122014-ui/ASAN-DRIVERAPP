const mongoose = require("mongoose");

const BillingSettingsSchema = new mongoose.Schema(
  {
    ratePerKm: {
      type: Number,
      required: true,
      default: 3,
    },

    platformCommission: {
      type: Number,
      required: true,
      default: 2,
    },

    billingType: {
      type: String,
      enum: ["postpaid", "prepaid"],
      default: "postpaid",
    },

    minimumFare: {
      type: Number,
      default: 50,
    },

    paymentDueDays: {
      type: Number,
      default: 5,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model(
  "BillingSettings",
  BillingSettingsSchema
);
