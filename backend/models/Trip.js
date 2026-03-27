import mongoose from "mongoose";

const tripSchema = new mongoose.Schema({

  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Parent"
  },

  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Driver"
  },

  childName: String,

  route: {
    from: String,
    to: String
  },

  status: {
    type: String,
    enum: ["pending", "picked", "in_transit", "completed"],
    default: "pending"
  },

  eta: String

}, { timestamps: true });

export default mongoose.model("Trip", tripSchema);
