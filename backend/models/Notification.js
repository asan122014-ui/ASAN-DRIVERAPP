// models/Notification.js

import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    driver: {
      type: String, // 🔥 IMPORTANT → MUST match driverId (STRING)
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true
    },
    message: {
      type: String,
      required: true
    },
    read: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

export default mongoose.model("Notification", notificationSchema);
