import mongoose from "mongoose";

const logSchema = new mongoose.Schema(
  {
    adminName: String,
    action: String,
    driverName: String
  },
  { timestamps: true }
);

export default mongoose.model("Log", logSchema);