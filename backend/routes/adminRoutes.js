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

    // ✅ CREATE TOKEN
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
    res.status(500).json({ message: "Login failed" });
  }
});

/* ================= ANALYTICS (ONLY ONE ROUTE) ================= */
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
    res.status(500).json({ message: "Analytics failed" });
  }
});

/* ================= DRIVERS ================= */
router.get("/drivers", async (req, res) => {
  const drivers = await Driver.find().select("-password");
  res.json({ success: true, data: drivers });
});

export default router;
