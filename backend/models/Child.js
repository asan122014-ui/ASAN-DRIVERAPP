import mongoose from "mongoose";

const childSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    age: {
      type: Number,
      default: null
    },

    school: {
      type: String,
      default: ""
    },

    grade: {
      type: String,
      default: ""
    },

    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Parent",
      required: true
    },

    // 🔥 SIMPLE STRING DRIVER ID
    driverId: {
      type: String,
      required: true,
      index: true
    },

    status: {
      type: String,
      enum: ["waiting", "onboard", "dropped"],
      default: "waiting"
    },

    /* ================= LOCATION ================= */
    location: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null }
    },

    dropLocationCoords: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null }
    },

    /* ================= TIMINGS ================= */
    pickupTime: String,
    dropoffTime: String,
    eveningPickup: String,
    eveningDrop: String,

    pickupLocation: String,
    dropoffLocation: String
  },
  { timestamps: true }
);

export default mongoose.model("Child", childSchema);
