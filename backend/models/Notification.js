import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      required: true,
      index: true
    },

    title: {
      type: String,
      required: true,
      trim: true
    },

    message: {
      type: String,
      required: true,
      trim: true
    },

    type: {
      type: String,
      enum: [
        "trip_assigned",
        "trip_started",
        "trip_completed",
        "driver_approved",
        "driver_rejected",
        "payment",
        "rating",
        "system"
      ],
      default: "system"
    },

    read: {
      type: Boolean,
      default: false,
      index: true
    },

    delivered: {
      type: Boolean,
      default: false
    },

    data: {
      type: Object
      /*
        example:
        {
          tripId: "...",
          studentId: "...",
          screen: "trip"
        }
      */
    }
  },
  { timestamps: true }
);

/* Faster driver notification queries */

notificationSchema.index({ driver: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
