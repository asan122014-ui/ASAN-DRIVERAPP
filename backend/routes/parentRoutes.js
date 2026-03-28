import express from "express";
import Parent from "../models/Parent.js";
import Driver from "../models/Driver.js";
import Trip from "../models/Trip.js";
import bcrypt from "bcryptjs";

const router = express.Router();

/* ================= REGISTER ================= */
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "All fields required"
      });
    }

    // check existing
    const existing = await Parent.findOne({ email });
    if (existing) {
      return res.status(400).json({
        message: "Email already registered"
      });
    }

    // create parent
    const parent = await Parent.create({
      name,
      email,
      password
    });

    res.json({
      success: true,
      data: {
        parent,
        token: "demo-token" // 🔥 replace with JWT later
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Registration failed"
    });
  }
});

/* ================= LOGIN ================= */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const parent = await Parent.findOne({ email });

    if (!parent || parent.password !== password) {
      return res.status(400).json({
        message: "Invalid credentials"
      });
    }

    res.json({
      success: true,
      data: {
        parent,
        token: "demo-token"
      }
    });

  } catch (err) {
    res.status(500).json({
      message: "Login failed"
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

    await Parent.findByIdAndUpdate(parentId, {
      driverId
    });

    res.json({
      success: true,
      message: "Driver linked successfully"
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Linking failed"
    });
  }
});

/* ================= DASHBOARD ================= */
router.get("/dashboard/:parentId", async (req, res) => {
  try {
    const parentId = req.params.parentId;

    const trips = await Trip.find({ parentId })
      .populate("driverId", "name driverId");

    res.json({
      success: true,
      data: trips
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard"
    });
  }
});

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

    // ✅ HASH PASSWORD (THIS IS THE FIX)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    parent.password = hashedPassword;

    await parent.save();

    res.json({
      success: true,
      message: "Password updated successfully"
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});
router.post("/check-email", async (req, res) => {
  try {
    const { email } = req.body;

    const parent = await Parent.findOne({ email });

    if (!parent) {
      return res.status(404).json({
        message: "Email not found"
      });
    }

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({
      message: "Server error"
    });
  }
});

export default router;
