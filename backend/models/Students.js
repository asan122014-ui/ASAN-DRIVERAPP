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
      required: true
    },

    schoolName: {
      type: String,
      required: true
    },

    parentName: {
      type: String
    },

    parentPhone: {
      type: String
    },

    /* ===== PICKUP LOCATION ===== */

    pickupLocation: {
      latitude: Number,
      longitude: Number,
      address: String
    },

    /* ===== DROP LOCATION ===== */

    dropLocation: {
      latitude: Number,
      longitude: Number,
      address: String
    },

    /* ===== DRIVER ASSIGNMENT ===== */

    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      index: true
    },

    /* ===== TRIP STATUS ===== */

    status: {
      type: String,
      enum: ["waiting", "onboard", "dropped"],
      default: "waiting",
      index: true
    },

    pickupTime: Date,

    dropTime: Date,

    /* ===== SAFETY ===== */

    emergencyContact: String,

    /* ===== SYSTEM ===== */

    active: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

/* Index for fast driver queries */

studentSchema.index({ driver: 1, status: 1 });

const Student = mongoose.model("Student", studentSchema);

export default Student;
