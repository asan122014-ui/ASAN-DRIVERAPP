import mongoose from "mongoose";

const tripSchema = new mongoose.Schema(
  {
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      required: true
    },

    tripType: {
      type: String,
      enum: ["morning", "afternoon"],
      required: true
    },

    status: {
      type: String,
      enum: ["active", "completed"],
      default: "active"
    },

    students: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Students"
      }
    ],

    totalStudents: {
      type: Number,
      default: 0
    },

    amount: {
      type: Number,
      default: 0
    },

    startTime: {
      type: Date,
      default: Date.now
    },

    endTime: {
      type: Date
    }
  },
  { timestamps: true }
);

const Trips = mongoose.model("Trips", tripSchema);

export default Trips;
