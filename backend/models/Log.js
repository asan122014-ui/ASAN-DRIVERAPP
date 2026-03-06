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
      index: true
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
      type: String
    },

    metadata: {
      type: Object
    },

    ipAddress: {
      type: String
    }
  },
  { timestamps: true }
);

/* Index for fast admin logs */

logSchema.index({ createdAt: -1 });

const Log = mongoose.model("Log", logSchema);

export default Log;
