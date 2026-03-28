import express from "express";
import bcrypt from "bcryptjs";

import Parent from "../models/Parent.js";
import Driver from "../models/Driver.js";
import Trip from "../models/Trip.js";

const router = express.Router();

/* ================= REGISTER ================= */
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields required"
      });
    }

    const existing = await Parent.findOne({ email });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Email already registered"
      });
    }

    // ✅ HASH PASSWORD
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const parent = await Parent.create({
      name,
      email,
      password: hashedPassword
    });

    // remove password from response
    const data = parent.toObject();
    delete data.password;

    res.json({
      success: true,
      data: {
        parent: data,
        token: "demo-token" // replace with JWT later
      }
    });

  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({
      success: false,
      message: "Registration failed"
    });
  }
});

/* ================= LOGIN ================= */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const parent = await Parent.findOne({ email });

    if (!parent) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // ✅ COMPARE HASH
    const isMatch = await bcrypt.compare(password, parent.password);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    const data = parent.toObject();
    delete data.password;

    res.json({
      success: true,
      data: {
        parent: data,
        token: "demo-token"
      }
    });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({
      success: false,
      message: "Login failed"
    });
  }
});

/* ================= CHECK EMAIL ================= */
router.post("/check-email", async (req, res) => {
  try {
    const { email } = req.body;

    const parent = await Parent.findOne({ email });

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: "Email not found"
      });
    }

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

/* ================= RESET PASSWORD ================= */
router.post("/reset-password", async (req, res) => {
  try {
    const { email, password } = req.body;

    const parent = await Parent.findOne({ email });

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // ✅ HASH PASSWORD
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    parent.password = hashedPassword;
    await parent.save();

    res.json({
      success: true,
      message: "Password updated successfully"
    });

  } catch (err) {
    console.error("Reset error:", err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

/* ================= LINK DRIVER ================= */
router.post("/link-driver", async (req, res) => {
  try {
    const { parentId, driverId } = req.body;

    const driver = await Driver.findOne({ driverId });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found"
      });
    }

    await Parent.findByIdAndUpdate(parentId, { driverId });

    res.json({
      success: true,
      message: "Driver linked successfully"
    });

  } catch (err) {
    console.error("Link driver error:", err);
    res.status(500).json({
      success: false,
      message: "Linking failed"
    });
  }
});

/* ================= DASHBOARD ================= */
router.get("/dashboard/:parentId", async (req, res) => {
  try {
    const { parentId } = req.params;

    const trips = await Trip.find({ parentId })
      .populate("driverId", "name driverId");

    res.json({
      success: true,
      data: trips
    });

  } catch (err) {
    console.error("Dashboard error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard"
    });
  }
});

export default router;
