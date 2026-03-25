import mongoose from "mongoose";

const tripSchema = new mongoose.Schema(
  {
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      required: true,
      index: true
    },

    tripType: {
      type: String,
      enum: ["morning", "afternoon"],
      required: true
    },

    status: {
      type: String,
      enum: ["active", "completed"],
      default: "active",
      index: true
    },

    students: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Student"
      }
    ],

    totalStudents: {
      type: Number,
      default: 0,
      min: 0
    },

    amount: {
      type: Number,
      default: 0,
      min: 0
    },

    startTime: {
      type: Date,
      default: Date.now
    },

    endTime: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

/* ================= INDEXES ================= */

// Fast queries for active trip per driver
tripSchema.index({ driver: 1, status: 1 });

// Optional: history sorting
tripSchema.index({ driver: 1, createdAt: -1 });

const Trips = mongoose.model("Trips", tripSchema);

export default Trips;
