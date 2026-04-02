import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    /* ================= DRIVER ================= */
    driver: {
      type: String, // driverId
      required: true,
      index: true,
      trim: true,
    },

    /* ================= PARENT ================= */
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Parent",
      default: null,
      index: true,
    },

    /* ================= CHILD (NEW 👶) ================= */
    childId: {
      type: String, // studentId / childId
      default: null,
      index: true,
    },

    /* ================= TITLE ================= */
    title: {
      type: String,
      required: true,
      trim: true,
    },

    /* ================= MESSAGE ================= */
    message: {
      type: String,
      required: true,
      trim: true,
    },

    /* ================= TYPE ================= */
    type: {
      type: String,
      enum: ["pickup", "drop", "trip_start", "trip_end", "delay", "emergency", "general"],
      default: "general",
      index: true,
    },

    /* ================= PRIORITY (🔥 NEW) ================= */
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "low",
      index: true,
    },

    /* ================= READ ================= */
    read: {
      type: Boolean,
      default: false,
      index: true,
    },

    /* ================= EXTRA DATA (OPTIONAL 🔥) ================= */
    meta: {
      type: Object,
      default: {},
    }
  },
  {
    timestamps: true,
  }
);

/* ================= INDEXES ================= */

// 🔥 Fast driver queries
notificationSchema.index({ driver: 1, createdAt: -1 });

// 🔥 Fast parent queries
notificationSchema.index({ parent: 1, createdAt: -1 });

// 🔥 Fast child queries
notificationSchema.index({ childId: 1, createdAt: -1 });

// 🔥 Priority filtering
notificationSchema.index({ priority: 1 });

// 🔥 Type filtering
notificationSchema.index({ type: 1 });

/* ================= MODEL ================= */
const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
