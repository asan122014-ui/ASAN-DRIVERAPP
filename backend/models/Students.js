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

    /* 🔥 IMPORTANT: LINK TO PARENT */
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Parent",
      required: true,
      index: true
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

    /* ===== DRIVER ===== */
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      index: true,
      default: null
    },

    /* ===== STATUS ===== */
    status: {
      type: String,
      enum: ["waiting", "onboard", "dropped"],
      default: "waiting",
      index: true
    },

    pickupTime: { type: Date, default: null },
    dropTime: { type: Date, default: null },

    active: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

studentSchema.index({ driver: 1, status: 1 });

export default mongoose.model("Student", studentSchema);
