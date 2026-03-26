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

    // ✅ Validate input
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: "Username and password required"
      });
    }

    // ✅ IMPORTANT: include password
    const admin = await Admin.findOne({ username }).select("+password");

    // ✅ Safety check (prevents bcrypt crash)
    if (!admin || !admin.password) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // ✅ Compare password
    const isMatch = await admin.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // ✅ Generate token
    const token = jwt.sign(
      { id: admin._id, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // ✅ Log admin login
    await AdminLog.create({
      adminId: admin._id,
      action: "ADMIN_LOGIN",
      message: `${admin.username} logged in`
    });

    // ✅ Response
    res.json({
      success: true,
      token,
      role: admin.role
    });

  } catch (error) {
    console.error("Admin login error:", error.message);
    res.status(500).json({
      success: false,
      message: "Login failed"
    });
  }
});
/* ================= ADMIN LOGOUT ================= */
router.post("/logout", verifyAdmin, async (req, res) => {
  try {
    await AdminLog.create({
      adminId: req.admin.id,
      action: "ADMIN_LOGOUT",
      message: "Admin logged out"
    });

    res.json({
      success: true,
      message: "Logged out successfully"
    });

  } catch (error) {
    console.error("Admin logout error:", error.message);
    res.status(500).json({
      success: false,
      message: "Logout failed"
    });
  }
});

/* ================= GET ALL DRIVERS ================= */
router.get("/drivers", verifyAdmin, async (req, res) => {
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
    console.error("Get drivers error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch drivers"
    });
  }
});

/* ================= GET DRIVER DETAILS ================= */
router.get("/drivers/:id", verifyAdmin, async (req, res) => {
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
    console.error("Get driver error:", error.message);
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
      adminId: req.admin.id,
      action: "DRIVER_APPROVED",
      driverId: driver._id,
      message: `Driver ${driver.name} approved`
    });

    res.json({
      success: true,
      message: "Driver approved successfully"
    });

  } catch (error) {
    console.error("Approve driver error:", error.message);
    res.status(500).json({
      success: false,
      message: "Driver approval failed"
    });
  }
});

/* ================= REJECT DRIVER ================= */
router.put("/drivers/:id/reject", verifyAdmin, async (req, res) => {
  try {
    const { reason } = req.body;

    const driver = await Driver.findByIdAndUpdate(
      req.params.id,
      { status: "rejected", rejectionReason: reason || "Rejected by admin" },
      { new: true }
    );

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found"
      });
    }

    await AdminLog.create({
      adminId: req.admin.id,
      action: "DRIVER_REJECTED",
      driverId: driver._id,
      message: `Driver ${driver.name} rejected`
    });

    res.json({
      success: true,
      message: "Driver rejected successfully"
    });

  } catch (error) {
    console.error("Reject driver error:", error.message);
    res.status(500).json({
      success: false,
      message: "Driver rejection failed"
    });
  }
});

/* ================= ADMIN LOGS ================= */
router.get("/logs", verifyAdmin, async (req, res) => {
  try {
    const logs = await AdminLog
      .find()
      .populate("adminId", "username")
      .populate("driverId", "name driverId")
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({
      success: true,
      data: logs
    });

  } catch (error) {
    console.error("Admin logs error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch logs"
    });
  }
});

/* ================= REGISTER DRIVER (ADMIN) ================= */
router.post("/register", verifyAdmin, async (req, res) => {
  try {
    const driver = await Driver.create(req.body);

    const io = req.app.get("io");
    if (io) {
      io.emit("new_driver", driver);
    }

    await AdminLog.create({
      adminId: req.admin.id,
      action: "DRIVER_CREATED",
      driverId: driver._id,
      message: `Driver ${driver.name} created`
    });

    res.json({
      success: true,
      data: driver
    });

  } catch (error) {
    console.error("Driver registration error:", error.message);
    res.status(500).json({
      success: false,
      message: "Driver registration failed"
    });
  }
});

export default router;
