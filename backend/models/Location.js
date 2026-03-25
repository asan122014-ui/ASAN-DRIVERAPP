import mongoose from "mongoose";

const locationSchema = new mongoose.Schema(
  {
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      required: true,
      index: true
    },

    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point"
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true
      }
    },

    speed: {
      type: Number,
      default: 0,
      min: 0
    },

    heading: {
      type: Number,
      default: 0,
      min: 0,
      max: 360
    }
  },
  { timestamps: true }
);

/* ================= INDEXES ================= */

// Geospatial index (for maps / nearby queries)
locationSchema.index({ location: "2dsphere" });

// Faster driver-based queries
locationSchema.index({ driver: 1, createdAt: -1 });

const Location = mongoose.model("Location", locationSchema);

export default Location;
