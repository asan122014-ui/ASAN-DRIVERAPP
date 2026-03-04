import mongoose from "mongoose";

const adminLogSchema = new mongoose.Schema(
{
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin"
  },

  action: {
    type: String,
    required: true
  },

  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Driver"
  },

  message: String

},
{ timestamps: true }
);

export default mongoose.model("AdminLog", adminLogSchema);
