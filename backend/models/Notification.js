import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      required: true,
      index: true // 🔥 faster queries per driver
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

    read: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

/* ================= INDEXES ================= */

// Fetch latest notifications quickly
notificationSchema.index({ driver: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
