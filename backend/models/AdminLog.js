import mongoose from "mongoose";

const adminLogSchema = new mongoose.Schema(
  {
    /* ================= ADMIN (OPTIONAL NOW) ================= */
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: false, // ✅ FIXED (was causing 500 error)
      index: true,
      default: null
    },

    /* ================= ACTION ================= */
    action: {
      type: String,
      required: true,
      trim: true
    },

    /* ================= DRIVER (OPTIONAL) ================= */
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      default: null
    },

    /* ================= MESSAGE ================= */
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

// Faster filtering by driver
adminLogSchema.index({ driverId: 1 });

/* ================= MODEL ================= */

const AdminLog = mongoose.model("AdminLog", adminLogSchema);

export default AdminLog;
