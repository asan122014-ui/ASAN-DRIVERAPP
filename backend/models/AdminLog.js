import mongoose from "mongoose";

const adminLogSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      index: true
    },

    action: {
      type: String,
      required: true,
      trim: true
    },

    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      default: null
    },

    message: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

/* Optional index for faster admin activity queries */

adminLogSchema.index({ adminId: 1, createdAt: -1 });

const AdminLog = mongoose.model("AdminLog", adminLogSchema);

export default AdminLog;
