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
      trim: true,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

/* ================= INDEXES ================= */

// Fast queries for admin activity logs
adminLogSchema.index({ adminId: 1, createdAt: -1 });

// Optional: faster filtering by driver
adminLogSchema.index({ driverId: 1 });

const AdminLog = mongoose.model("AdminLog", adminLogSchema);

export default AdminLog;
