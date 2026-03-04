import mongoose from "mongoose";

const adminSchema = new mongoose.Schema({
  username: String,
  password: String,

  role: {
    type: String,
    enum: ["superadmin", "reviewer"],
    default: "reviewer"
  }
});

export default mongoose.model("Admin", adminSchema);
