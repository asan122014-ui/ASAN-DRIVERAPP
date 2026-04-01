import mongoose from "mongoose";

const studentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },

    // 🔥 IMPORTANT: link to driver using driverId (STRING)
    driver: {
      type: String,
      required: true,
      index: true
    },

    status: {
      type: String,
      enum: ["waiting", "onboard", "dropped"],
      default: "waiting"
    },

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
    }
  },
  { timestamps: true }
);

export default mongoose.model("Students", studentSchema);
