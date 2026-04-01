import mongoose from "mongoose";

const studentSchema = new mongoose.Schema(
  {
    /* ================= BASIC INFO ================= */
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

    /* ================= DRIVER LINK ================= */
    // 🔥 STRING driverId (your custom ID like ASAN-XXXX)
    driver: {
      type: String,
      required: true,
      index: true
    },

    /* ================= STATUS ================= */
    status: {
      type: String,
      enum: ["waiting", "onboard", "dropped"],
      default: "waiting"
    },

    /* ================= LOCATION ================= */
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point"
      },
      coordinates: {
        type: [Number], // [lng, lat]
        default: [0, 0]
      }
    },

    dropLocationCoords: {
      lat: { type: Number, default: 0 },
      lng: { type: Number, default: 0 }
    },

    /* ================= TIMINGS ================= */
    pickupTime: {
      type: String,
      default: ""
    },

    dropoffTime: {
      type: String,
      default: ""
    },

    eveningPickup: {
      type: String,
      default: ""
    },

    eveningDrop: {
      type: String,
      default: ""
    }
  },
  { timestamps: true }
);

/* ================= INDEX ================= */
studentSchema.index({ location: "2dsphere" });

export default mongoose.model("Students", studentSchema);
