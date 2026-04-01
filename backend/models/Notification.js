import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    /* ================= DRIVER ================= */
    driver: {
      type: String, // driverId (STRING)
      required: true,
      index: true,
      trim: true
    },

    /* ================= PARENT ================= */
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Parent",
      default: null,
      index: true
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

    /* ================= TYPE (OPTIONAL BUT POWERFUL) ================= */
    type: {
      type: String,
      enum: ["pickup", "drop", "trip_start", "trip_end", "general"],
      default: "general"
    },

    /* ================= READ STATUS ================= */
    read: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  {
    timestamps: true
  }
);

/* ================= INDEXES ================= */

// 🔥 Fast driver queries
notificationSchema.index({ driver: 1, createdAt: -1 });

// 🔥 Fast parent queries
notificationSchema.index({ parent: 1, createdAt: -1 });

/* ================= MODEL ================= */

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
