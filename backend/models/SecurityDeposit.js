import mongoose from "mongoose";

const securityDepositSchema = new mongoose.Schema(
  {
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    totalDeposit: {
      type: Number,
      required: true,
      default: 1000,
    },

    availableBalance: {
      type: Number,
      required: true,
      default: 1000,
    },

    usedAmount: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ["Active", "Low Balance", "Exhausted"],
      default: "Active",
    },

    lastDeductedAt: {
      type: Date,
      default: null,
    },

    remarks: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model(
  "SecurityDeposit",
  securityDepositSchema
);
