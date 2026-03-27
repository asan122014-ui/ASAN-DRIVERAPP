import mongoose from "mongoose";

const parentSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,

  driverId: {
    type: String // ASAN ID
  }

}, { timestamps: true });

export default mongoose.model("Parent", parentSchema);
