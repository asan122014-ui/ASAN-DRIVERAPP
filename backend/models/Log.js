import mongoose from "mongoose";

const logSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      index: true
    },

    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      index: true,
      default: null
    },

    action: {
      type: String,
      required: true,
      enum: [
        "DRIVER_APPROVED",
        "DRIVER_REJECTED",
        "DRIVER_CREATED",
        "TRIP_STARTED",
        "TRIP_ENDED",
        "STUDENT_ASSIGNED",
        "NOTIFICATION_SENT"
      ]
    },

    message: {
      type: String,
      default: ""
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed, // 🔥 better than Object
      default: {}
    },

    ipAddress: {
      type: String,
      default: null
    }
  },
  { timestamps: true }
);

/* ================= INDEXES ================= */

// Latest logs (global)
logSchema.index({ createdAt: -1 });

// Admin activity tracking
logSchema.index({ admin: 1, createdAt: -1 });

// Driver-specific logs
logSchema.index({ driver: 1, createdAt: -1 });

const Log = mongoose.model("Log", logSchema);

export default Log;
