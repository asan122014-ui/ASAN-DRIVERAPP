import express from "express";
import verifyAdmin from "../middleware/verifyAdmin.js";
import Driver from "../models/Driver.js";

const router = express.Router();

/* ================= ADMIN ANALYTICS ================= */

router.get("/analytics", verifyAdmin, async (req, res) => {
  try {

    /* ===== DRIVER COUNTS ===== */

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

    /* ===== LAST 7 DAYS DATE ===== */

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    /* ===== DRIVER REGISTRATIONS ===== */

    const registrations = await Driver.aggregate([
      {
        $match: {
          createdAt: { $gte: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt"
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    /* ===== DRIVER APPROVALS ===== */

    const approvals = await Driver.aggregate([
      {
        $match: {
          status: "approved",
          updatedAt: { $gte: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$updatedAt"
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    /* ===== RESPONSE ===== */

    res.json({
      success: true,
      analytics: {
        drivers: {
          total: totalDrivers,
          pending: pendingDrivers,
          approved: approvedDrivers,
          rejected: rejectedDrivers
        },
        registrations,
        approvals
      }
    });

  } catch (error) {

    console.error("Admin analytics error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch analytics"
    });

  }
});

export default router;
