import mongoose from "mongoose";

const billingSettingsSchema = new mongoose.Schema(
  {
    ratePerKm: {
      type: Number,
      required: true,
      default: 3,
      min: 0,
    },

    platformCommission: {
      type: Number,
      required: true,
      default: 2,
      min: 0,
      max: 100,
    },

    billingType: {
      type: String,
      enum: ["postpaid", "prepaid"],
      default: "postpaid",
    },

    minimumFare: {
      type: Number,
      default: 50,
      min: 0,
    },

    paymentDueDays: {
      type: Number,
      default: 5,
      min: 1,
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

const BillingSettings = mongoose.model(
  "BillingSettings",
  billingSettingsSchema
);

export default BillingSettings;
