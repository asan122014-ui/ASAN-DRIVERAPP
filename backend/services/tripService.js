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

    /* Students in this trip */

    students: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Student"
      }
    ],

    totalStudents: {
      type: Number,
      default: 0
    },

    /* Financial */

    amount: {
      type: Number,
      default: 0
    },

    rating: {
      type: Number,
      min: 0,
      max: 5
    },

    /* Trip Status */

    status: {
      type: String,
      enum: ["active", "completed", "cancelled"],
      default: "active",
      index: true
    },

    /* Trip Timing */

    startTime: {
      type: Date
    },

    endTime: {
      type: Date
    },

    duration: {
      type: Number // minutes
    },

    /* Distance Tracking */

    distance: {
      type: Number, // kilometers
      default: 0
    },

    /* Start Location */

    startLocation: {
      latitude: Number,
      longitude: Number,
      address: String
    },

    /* End Location */

    endLocation: {
      latitude: Number,
      longitude: Number,
      address: String
    }
  },
  { timestamps: true }
);

/* Index for fast queries */

tripSchema.index({ driver: 1, createdAt: -1 });

const Trips = mongoose.model("Trips", tripSchema);
export default Trips;
