import mongoose from "mongoose";

const childSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    age: {
      type: String,
      default: "",
    },

    school: {
      type: String,
      default: "",
    },

    grade: {
      type: String,
      default: "",
    },

    pickupTime: {
      type: String,
      default: "",
    },

    dropoffTime: {
      type: String,
      default: "",
    },

    pickupLocation: {
      type: String,
      default: "",
    },

    dropoffLocation: {
      type: String,
      default: "",
    },

    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Parent",
      required: true,
    },

    driverId: {
      type: String,
      required: true,
      index: true, // 🔥 faster queries for driver
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("Child", childSchema);
