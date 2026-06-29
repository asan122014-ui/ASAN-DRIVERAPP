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
      default: "", // Driver can be linked later
      index: true,
    },

    /* ================= STATUS ================= */
    status: {
      type: String,
      enum: ["waiting", "onboard", "dropped", "absent"],
      default: "waiting",
    },

    /* ================= PICKUP LOCATION ================= */
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

    /* ================= DROP LOCATION ================= */
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

    /* ================= ROUTE DETAILS ================= */
    routeDistance: {
      type: Number,
      default: 0,
    },

    estimatedDuration: {
      type: Number,
      default: 0,
    },

    /* ================= BILLING ================= */
    registrationFeePaid: {
      type: Boolean,
      default: false,
    },

    securityDeposit: {
      type: Number,
      default: 0,
    },

    depositBalance: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

/* ================= INDEXES ================= */

childSchema.index({
  driverId: 1,
});

childSchema.index({
  parentId: 1,
});

export default mongoose.model("Child", childSchema);
