import Driver from "../models/Driver.js";
import Students from "../models/Students.js";
import Trips from "../models/Trips.js";
import AdminLog from "../models/AdminLog.js";

/* ================= DASHBOARD STATS ================= */
export const getDashboardStats = async (req, res) => {
  try {
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

    res.json({
      success: true,
      data: {
        totalDrivers,
        pendingDrivers,
        approvedDrivers,
        rejectedDrivers
      }
    });

  } catch (error) {
    console.error("Dashboard Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard stats"
    });
  }
};

/* ================= GET ALL DRIVERS ================= */
export const getDrivers = async (req, res) => {
  try {
    const drivers = await Driver
      .find()
      .select("-password")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: drivers
    });

  } catch (error) {
    console.error("Get Drivers Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch drivers"
    });
  }
};

/* ================= GET DRIVER BY ID ================= */
export const getDriverById = async (req, res) => {
  try {
    const driver = await Driver
      .findById(req.params.id)
      .select("-password");

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found"
      });
    }

    res.json({
      success: true,
      data: driver
    });

  } catch (error) {
    console.error("Get Driver Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch driver"
    });
  }
};

/* ================= APPROVE DRIVER ================= */
export const approveDriver = async (req, res) => {
  try {
    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      { status: "approved", rejectionReason: null },
      { new: true }
    );

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found"
      });
    }

    // Optional logging
    await AdminLog.create({
      action: "DRIVER_APPROVED",
      driverId: driver._id,
      message: `Driver ${driver.name} approved`
    });

    res.json({
      success: true,
      message: "Driver approved successfully"
    });

  } catch (error) {
    console.error("Approve Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to approve driver"
    });
  }
};

/* ================= REJECT DRIVER ================= */
export const rejectDriver = async (req, res) => {
  try {
    const { reason } = req.body;

    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      {
        status: "rejected",
        rejectionReason: reason || "Rejected"
      },
      { new: true }
    );

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found"
      });
    }

    await AdminLog.create({
      action: "DRIVER_REJECTED",
      driverId: driver._id,
      message: `Driver ${driver.name} rejected`
    });

    res.json({
      success: true,
      message: "Driver rejected successfully"
    });

  } catch (error) {
    console.error("Reject Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to reject driver"
    });
  }
};

/* ================= GET LOGS ================= */
export const getLogs = async (req, res) => {
  try {
    const logs = await AdminLog
      .find()
      .populate("adminId", "username")
      .populate("driverId", "name driverId")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: logs
    });

  } catch (error) {
    console.error("Logs Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch logs"
    });
  }
};
/* ================= ANALYTICS ================= */
export const getAnalytics = async (req, res) => {
  try {
    // 📊 Registrations (last 7 days)
    const registrations = await Driver.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(new Date().setDate(new Date().getDate() - 7))
          }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      }
    ]);

    // ✅ Approvals (last 7 days)
    const approvals = await Driver.aggregate([
      {
        $match: {
          status: "approved",
          updatedAt: {
            $gte: new Date(new Date().setDate(new Date().getDate() - 7))
          }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" }
          },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        registrations,
        approvals
      }
    });

  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch analytics"
    });
  }
};
