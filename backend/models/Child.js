import mongoose from "mongoose";

const childSchema = new mongoose.Schema(
  {
    /* ================= CHILD INFO ================= */

    name: {
      type: String,
      required: true,
      trim: true,
    },

    age: {
      type: Number,
      default: null,
    },

    school: {
      type: String,
      default: "",
    },

    grade: {
      type: String,
      default: "",
    },

    /* ================= PARENT ================= */

    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Parent",
      required: true,
    },

    /* ================= DRIVER ================= */

    driverId: {
      type: String,
      required: true,
      index: true,
    },

    /* ================= STATUS ================= */

    status: {
      type: String,
      enum: ["waiting", "onboard", "dropped", "absent"],
      default: "waiting",
    },

    /* ================= LIVE LOCATION ================= */

    location: {
      lat: {
        type: Number,
        default: null,
      },
      lng: {
        type: Number,
        default: null,
      },
    },

    dropLocationCoords: {
      lat: {
        type: Number,
        default: null,
      },
      lng: {
        type: Number,
        default: null,
      },
    },

    /* ================= TIMINGS ================= */

    pickupTime: {
      type: String,
      default: "",
    },

    dropoffTime: {
      type: String,
      default: "",
    },

    eveningPickup: {
      type: String,
      default: "",
    },

    eveningDrop: {
      type: String,
      default: "",
    },

    /* ================= ADDRESSES ================= */

    pickupLocation: {
      type: String,
      default: "",
    },

    dropoffLocation: {
      type: String,
      default: "",
    },

    /* ================= BILLING ================= */

    // Google Maps one-way distance in KM
    routeDistance: {
      type: Number,
      default: 0,
    },

    // Google Maps travel duration in minutes
    estimatedDuration: {
      type: Number,
      default: 0,
    },

    // Registration fee paid
    registrationFeePaid: {
      type: Boolean,
      default: false,
    },

    // Security deposit amount
    securityDeposit: {
      type: Number,
      default: 0,
    },

    // Remaining deposit balance
    depositBalance: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

childSchema.index({ driverId: 1 });
childSchema.index({ parentId: 1 });

export default mongoose.model("Child", childSchema);
