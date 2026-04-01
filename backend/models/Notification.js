import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    /* ================= DRIVER ================= */
    driver: {
      type: String, // ✅ MUST match driverId (STRING)
      required: true,
      index: true,
      trim: true
    },

    /* ================= TITLE ================= */
    title: {
      type: String,
      required: true,
      trim: true
    },

    /* ================= MESSAGE ================= */
    message: {
      type: String,
      required: true,
      trim: true
    },

    /* ================= READ STATUS ================= */
    read: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true // createdAt, updatedAt
  }
);

/* ================= INDEXES ================= */
// 🔥 Fast fetch for dashboard
notificationSchema.index({ driver: 1, createdAt: -1 });

/* ================= MODEL ================= */
const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
