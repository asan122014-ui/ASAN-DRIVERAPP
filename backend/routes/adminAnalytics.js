import express from "express";
import verifyAdmin from "../middleware/verifyAdmin.js";
import Driver from "../models/Driver.js";

const router = express.Router();

/* ================= ADMIN ANALYTICS ================= */
router.get("/analytics", verifyAdmin, async (req, res) => {
  try {
    /* ===== DATE RANGE ===== */
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    /* ===== DRIVER COUNTS (parallel for speed) ===== */
    const [
      totalDrivers,
      pendingDrivers,
      approvedDrivers,
      rejectedDrivers
    ] = await Promise.all([
      Driver.countDocuments(),
      Driver.countDocuments({ status: "pending" }),
      Driver.countDocuments({ status: "approved" }),
      Driver.countDocuments({ status: "rejected" })
    ]);

    /* ===== REGISTRATIONS (LAST 7 DAYS) ===== */
    const registrations = await Driver.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
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

    /* ===== APPROVALS (LAST 7 DAYS) ===== */
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
    res.status(200).json({
      success: true,
      data: {
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
    console.error("Admin analytics error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to fetch analytics"
    });
  }
});

export default router;
