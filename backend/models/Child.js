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

    /* ================= MORNING ================= */
    pickupTime: {
      type: String,
      default: "",
    },

    dropoffTime: {
      type: String,
      default: "",
    },

    /* ================= EVENING ================= */
    eveningPickup: {
      type: String,
      default: "",
    },

    eveningDrop: {
      type: String,
      default: "",
    },

    /* ================= LOCATIONS ================= */
    pickupLocation: {
      type: String, // now stores address (not lat/lng)
      default: "",
    },

    dropoffLocation: {
      type: String,
      default: "",
    },

    /* OPTIONAL: keep coordinates if needed later */
    location: {
      lat: { type: Number },
      lng: { type: Number },
    },

    /* ================= STATUS ================= */
    status: {
      type: String,
      enum: ["waiting", "onboard", "dropped"],
      default: "waiting",
      index: true,
    },

    /* ================= RELATIONS ================= */
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

/* ================= INDEXES ================= */

// Fast driver dashboard queries
childSchema.index({ driverId: 1, status: 1 });

// Optional: faster parent queries
childSchema.index({ parentId: 1 });

export default mongoose.model("Child", childSchema);
