import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    /* ================= DRIVER ================= */
    driver: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    /* ================= PARENT ================= */
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Parent",
      required: true,
      index: true,
    },

    /* ================= CHILD ================= */
    child: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Child",
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
      enum: [
        "pickup",
        "drop",
        "trip_start",
        "trip_started",
        "trip_end",
        "trip_ended",
        "morning_drop_photo_uploaded",
        "afternoon_pickup_photo_uploaded",
        "delay",
        "emergency",
        "general",
      ],
      default: "general",
      index: true,
    },

    /* ================= PRIORITY ================= */
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

    /* ================= EXTRA DATA ================= */
    meta: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

/* ================= INDEXES ================= */
notificationSchema.index({ driver: 1, createdAt: -1 });
notificationSchema.index({ parent: 1, read: 1, createdAt: -1 });
notificationSchema.index({ child: 1, createdAt: -1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ priority: 1 });

/* ================= EXPORT ================= */
const Notification =
  mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);

export default Notification;
