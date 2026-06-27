import mongoose from "mongoose";

const studentSchema = new mongoose.Schema(
  {
    /* ================= STUDENT INFO ================= */

    name: {
      type: String,
      required: true,
      trim: true,
    },

    className: {
      type: String,
      required: true,
      trim: true,
    },

    schoolName: {
      type: String,
      required: true,
      trim: true,
    },

    /* ================= PARENT ================= */

    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Parent",
      required: true,
      index: true,
    },

    parentName: {
      type: String,
      trim: true,
      default: "",
    },

    parentPhone: {
      type: String,
      trim: true,
      default: "",
    },

    /* ================= PICKUP ================= */

    pickupLocation: {
      latitude: {
        type: Number,
        required: true,
      },

      longitude: {
        type: Number,
        required: true,
      },

      address: {
        type: String,
        default: "",
      },
    },

    /* ================= DROP ================= */

    dropLocation: {
      latitude: {
        type: Number,
        required: true,
      },

      longitude: {
        type: Number,
        required: true,
      },

      address: {
        type: String,
        default: "",
      },
    },

    /* ================= ROUTE DETAILS ================= */

    // One-way distance from pickup to school
    routeDistance: {
      type: Number,
      required: true,
      default: 0,
    },

    // Estimated travel time in minutes
    estimatedDuration: {
      type: Number,
      default: 0,
    },

    /* ================= DRIVER ================= */

    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      default: null,
      index: true,
    },

    /* ================= TRIP STATUS ================= */

    status: {
      type: String,
      enum: ["waiting", "onboard", "dropped"],
      default: "waiting",
      index: true,
    },

    pickupTime: {
      type: Date,
      default: null,
    },

    dropTime: {
      type: Date,
      default: null,
    },

    /* ================= ACTIVE ================= */

    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

/* ================= INDEXES ================= */

studentSchema.index({
  driver: 1,
  status: 1,
});

export default mongoose.model("Student", studentSchema);
