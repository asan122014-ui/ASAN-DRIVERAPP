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
      default: 0
    },

    heading: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
);

/* Geospatial index for map queries */

locationSchema.index({ location: "2dsphere" });

const Location = mongoose.model("Location", locationSchema);

export default Location;
