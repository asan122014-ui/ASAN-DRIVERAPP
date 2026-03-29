import express from "express";
import Parent from "../models/Parent.js";
import Driver from "../models/Driver.js";
import Trip from "../models/Trip.js";
import bcrypt from "bcryptjs";

const router = express.Router();

/* ================= REGISTER ================= */
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    const parent = await Parent.create({
      name,
      email,
      password,
      phone
    });

    res.json({ success: true, data: { parent } });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Signup failed" });
  }
});

export default router;
/* ================= LOGIN ================= */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const parent = await Parent.findOne({ email });

    if (!parent) {
      return res.status(400).json({
        message: "Invalid credentials"
      });
    }

    // ✅ COMPARE HASHED PASSWORD
    const isMatch = await bcrypt.compare(password, parent.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid credentials"
      });
    }

    res.json({
      success: true,
      data: { parent }
    });

  } catch (err) {
    res.status(500).json({
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

/* ================= RESET PASSWORD ================= */
router.post("/reset-password", async (req, res) => {
  try {
    const { email, password } = req.body;

    const parent = await Parent.findOne({ email });

    if (!parent) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    // ✅ HASH NEW PASSWORD
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    parent.password = hashedPassword;
    await parent.save();

    res.json({
      success: true,
      message: "Password updated"
    });

  } catch (err) {
    res.status(500).json({
      message: "Server error"
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
    console.error(err);
    res.status(500).json({
      message: "Failed to fetch dashboard"
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
        message: "Driver not found"
      });
    }

    await Parent.findByIdAndUpdate(parentId, {
      driverId
    });

    res.json({
      success: true,
      message: "Driver linked"
    });

  } catch (err) {
    res.status(500).json({
      message: "Linking failed"
    });
  }
});

export default router;
