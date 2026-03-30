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

    /* 🔥 MOST IMPORTANT FIELD (FOR DRIVER FLOW) */
    status: {
      type: String,
      enum: ["waiting", "onboard", "dropped"],
      default: "waiting",
      index: true,
    },

    /* 🔥 OPTIONAL (FUTURE MAP SUPPORT) */
    location: {
      lat: { type: Number },
      lng: { type: Number },
    },

    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Parent",
      required: true,
      index: true,
    },

    driverId: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

/* 🔥 COMPOUND INDEX (VERY FAST DRIVER DASHBOARD) */
childSchema.index({ driverId: 1, status: 1 });

export default mongoose.model("Child", childSchema);
