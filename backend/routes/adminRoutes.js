import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import Admin from "../models/Admin.js";
import Driver from "../models/Driver.js";
import AdminLog from "../models/AdminLog.js";
import verifyAdmin from "../middleware/verifyAdmin.js";

const router = express.Router();

/* ================= ADMIN LOGIN ================= */
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const admin = await Admin.findOne({ username }).select("+password");

    if (!admin) {
      return res.status(401).json({ message: "Invalid username" });
    }

    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const token = jwt.sign(
      { id: admin._id, role: admin.role },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      role: admin.role
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Login failed" });
  }
});

/* ================= ANALYTICS ================= */
router.get("/analytics", verifyAdmin, async (req, res) => {
  try {
    const total = await Driver.countDocuments();
    const pending = await Driver.countDocuments({ status: "pending" });
    const approved = await Driver.countDocuments({ status: "approved" });
    const rejected = await Driver.countDocuments({ status: "rejected" });

    res.json({
      success: true,
      data: {
        summary: {
          total,
          pending,
          approved,
          rejected
        }
      }
    });

  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({ message: "Analytics failed" });
  }
});

/* ================= GET ALL DRIVERS ================= */
router.get("/drivers", verifyAdmin, async (req, res) => {
  try {
    const drivers = await Driver.find()
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
router.get("/drivers/:id", verifyAdmin, async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id).select("-password");

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
router.put("/drivers/:id/approve", verifyAdmin, async (req, res) => {
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

    await AdminLog.create({
      action: "DRIVER_APPROVED",
      driverId: driver._id,
      message: `Driver ${driver.name} approved`
    });

    // 🔌 SOCKET
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
router.put("/drivers/:id/reject", verifyAdmin, async (req, res) => {
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
router.get("/logs", verifyAdmin, async (req, res) => {
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

export default router;
