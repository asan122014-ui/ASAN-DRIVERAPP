import mongoose from "mongoose";

const studentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    className: {
      type: String,
      required: true,
      trim: true
    },

    schoolName: {
      type: String,
      required: true,
      trim: true
    },

    parentName: {
      type: String,
      trim: true,
      default: ""
    },

    parentPhone: {
      type: String,
      trim: true,
      default: ""
    },

    /* ===== PICKUP LOCATION ===== */
    pickupLocation: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      address: { type: String, default: "" }
    },

    /* ===== DROP LOCATION ===== */
    dropLocation: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      address: { type: String, default: "" }
    },

    /* ===== DRIVER ASSIGNMENT ===== */
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      index: true,
      default: null
    },

    /* ===== TRIP STATUS ===== */
    status: {
      type: String,
      enum: ["waiting", "onboard", "dropped"],
      default: "waiting",
      index: true
    },

    pickupTime: {
      type: Date,
      default: null
    },

    dropTime: {
      type: Date,
      default: null
    },

    /* ===== SAFETY ===== */
    emergencyContact: {
      type: String,
      trim: true,
      default: ""
    },

    /* ===== SYSTEM ===== */
    active: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  { timestamps: true }
);

/* ================= INDEXES ================= */

// Driver + status (fast filtering during trips)
studentSchema.index({ driver: 1, status: 1 });

// Optional: active students per driver
studentSchema.index({ driver: 1, active: 1 });

const Student = mongoose.model("Student", studentSchema);

export default Student;
