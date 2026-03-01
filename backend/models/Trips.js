import mongoose from "mongoose";

const tripSchema = new mongoose.Schema(
  {
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      required: true,
    },
    tripType: {
      type: String,
      enum: ["Morning", "Afternoon"],
      required: true,
    },
    students: {
      type: Number,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    rating: Number,
    status: {
      type: String,
      enum: ["Active", "Completed"],
      default: "Active",
    },
    startTime: Date,
    endTime: Date,
  },
  { timestamps: true }
);

export default mongoose.model("Trip", tripSchema);