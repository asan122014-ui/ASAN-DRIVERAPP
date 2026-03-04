import express from "express";
import verifyAdmin from "../middleware/verifyAdmin.js";
import Driver from "../models/Driver.js";
import AdminLog from "../models/AdminLog.js";

const router = express.Router();

router.get("/analytics", verifyAdmin, async (req, res) => {
  try {

    const totalDrivers = await Driver.countDocuments();

    const pendingDrivers = await Driver.countDocuments({
      status: "pending"
    });

    const approvedDrivers = await Driver.countDocuments({
      status: "approved"
    });

    const rejectedDrivers = await Driver.countDocuments({
      status: "rejected"
    });

    const recentLogs = await AdminLog.find()
      .populate("adminId", "username")
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      totalDrivers,
      pendingDrivers,
      approvedDrivers,
      rejectedDrivers,
      recentLogs
    });

  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
