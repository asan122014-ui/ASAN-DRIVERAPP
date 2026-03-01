import mongoose from "mongoose";

const studentSchema = new mongoose.Schema({
  name: String,
  className: String,
  status: {
    type: String,
    enum: ["Waiting", "On Board", "Dropped"],
    default: "Waiting",
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Driver",
  },
}, { timestamps: true });

export default mongoose.model("Student", studentSchema);