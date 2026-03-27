import express from "express";
import bcrypt from "bcryptjs";
import { getAnalytics } from "../controllers/adminController.js";
import verifyAdmin from "../middleware/verifyAdmin.js";
import Admin from "../models/Admin.js";
import Driver from "../models/Driver.js";
import AdminLog from "../models/AdminLog.js";

const router = express.Router();

/* ================= ADMIN LOGIN ================= */
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password required"
      });
    }

    const admin = await Admin.findOne({ username }).select("+password");

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid username"
      });
    }

    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid password"
      });
    }

    res.json({
      success: true,
      role: admin.role
    });

  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      success: false,
      message: "Login failed"
    });
  }
});

/* ================= GET ALL DRIVERS ================= */
router.get("/drivers", async (req, res) => {
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
    console.error("Drivers fetch error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch drivers"
    });
  }
});

/* ================= GET DRIVER DETAILS ================= */
router.get("/drivers/:id", async (req, res) => {
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
    console.error("Driver fetch error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch driver"
    });
  }
});

/* ================= APPROVE DRIVER ================= */
router.put("/drivers/:id/approve", async (req, res) => {
  try {
    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      {
        status: "approved",
        rejectionReason: null
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
      action: "DRIVER_APPROVED",
      driverId: driver._id,
      message: `Driver ${driver.name} approved`
    });
    const io = req.app.get("io");

if (io) {
  io.emit("driver_approved", {
    date: new Date().toISOString().split("T")[0]
  });
}

    res.json({
      success: true,
      message: "Driver approved successfully"
    });

  } catch (error) {
    console.error("Approve error:", error);

    res.status(500).json({
      success: false,
      message: "Approval failed"
    });
  }
});

/* ================= REJECT DRIVER ================= */
router.put("/drivers/:id/reject", async (req, res) => {
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
    console.error("Reject error:", error);

    res.status(500).json({
      success: false,
      message: "Rejection failed"
    });
  }
});

/* ================= ADMIN LOGS ================= */
router.get("/logs", async (req, res) => {
  try {
    const logs = await AdminLog.find()
      .populate("adminId", "username")
      .populate("driverId", "name driverId")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: logs
    });

  } catch (error) {
    console.error("Logs error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch logs"
    });
  }
});

/* ================= ANALYTICS (FIXED) ================= */
router.get("/analytics", async (req, res) => {
  try {
    const total = await Driver.countDocuments();
    const pending = await Driver.countDocuments({ status: "pending" });
    const approved = await Driver.countDocuments({ status: "approved" });
    const rejected = await Driver.countDocuments({ status: "rejected" });

    res.json({
      success: true,
      analytics: {
        drivers: {
          total,
          pending,
          approved,
          rejected
        }
      }
    });

  } catch (error) {
    console.error("Analytics error:", error);

    res.status(500).json({
      success: false,
      message: "Analytics failed"
    });
  }
});
router.get("/analytics", verifyAdmin, getAnalytics);

export default router;
