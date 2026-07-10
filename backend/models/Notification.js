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
      default: null,
      index: true,
    },

    /* ================= CHILD ================= */
    child: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Child",
      default: null,
      index: true,
    },

    /* ================= RECIPIENT TYPE ================= */
    recipientType: {
      type: String,
      enum: ["parent", "driver"],
      required: true,
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
        // Student actions
        "pickup",
        "drop",
        "student_picked_up",
        "student_dropped",

        // Trip events
        "trip_start",
        "trip_started",
        "trip_end",
        "trip_ended",

        // Payment
        "payment_received",

        // Photo verification
        "morning_drop_verified",
        "afternoon_pickup_verified",
        "morning_drop_photo_uploaded",
        "afternoon_pickup_photo_uploaded",

        // Driver request
        "driver_request_submitted",
        "driver_request_accepted",

        // Driver assignment
        "driver_assigned",
        "driver_changed",

        // Other
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
notificationSchema.index({ recipientType: 1, parent: 1, createdAt: -1 });
notificationSchema.index({ recipientType: 1, driver: 1, createdAt: -1 });

/* ================= EXPORT ================= */
const Notification =
  mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);

export default Notification;
