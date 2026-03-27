import express from "express";
import Admin from "../models/Admin.js";
import Driver from "../models/Driver.js";
import AdminLog from "../models/AdminLog.js";

const router = express.Router();

/* ================= ADMIN LOGIN ================= */
import bcrypt from "bcryptjs";

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    // 🔍 Find admin
    const admin = await Admin.findOne({ username }).select("+password");

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid username"
      });
    }

    // 🔑 Compare password (IMPORTANT FIX)
    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid password"
      });
    }

    // ✅ Success
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
    const drivers = await Driver.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      data: drivers
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch drivers"
    });
  }
});

/* ================= GET DRIVER DETAILS ================= */
router.get("/drivers/:id", async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id);

    res.json({
      success: true,
      data: driver
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch driver"
    });
  }
});

/* ================= APPROVE DRIVER ================= */
router.put("/drivers/:id/approve", async (req, res) => {
  try {
    await Driver.findByIdAndUpdate(req.params.id, {
      status: "approved",
      rejectionReason: null
    });

    res.json({
      success: true,
      message: "Driver approved"
    });

  } catch (error) {
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

    await Driver.findByIdAndUpdate(req.params.id, {
      status: "rejected",
      rejectionReason: reason || "Rejected"
    });

    res.json({
      success: true,
      message: "Driver rejected"
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Rejection failed"
    });
  }
});

/* ================= LOGS ================= */
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
    res.status(500).json({
      success: false,
      message: "Failed to fetch logs"
    });
  }
});

export default router;
