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
      type: String, // address (UI)
      default: "",
    },

    dropoffLocation: {
      type: String,
      default: "",
    },

    /* ================= COORDINATES ================= */

    // ✅ Pickup coordinates (USED FOR ROUTING)
    location: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },

    // ✅ ADD THIS (IMPORTANT FOR DROP ROUTING)
    dropLocationCoords: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
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

// 🔥 Fast driver dashboard
childSchema.index({ driverId: 1, status: 1 });

// 🔥 Fast parent queries
childSchema.index({ parentId: 1 });

export default mongoose.model("Child", childSchema);
