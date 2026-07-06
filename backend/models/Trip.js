import mongoose from "mongoose";

const tripSchema = new mongoose.Schema(
  {
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Parent",
    },

    driverId: {
      type: String,
      required: true,
    },

    childName: String,

    route: {
      from: String,
      to: String,
    },

    status: {
      type: String,
      enum: ["pending", "picked", "in_transit", "completed"],
      default: "pending",
    },

    // NEW FIELDS
    startTime: {
      type: Date,
      default: null,
    },

    endTime: {
      type: Date,
      default: null,
    },

    duration: {
      type: Number, // minutes
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Trip", tripSchema);
