import express from "express";
import Parent from "../models/Parent.js";
import Driver from "../models/Driver.js";
import Trip from "../models/Trips.js";
import bcrypt from "bcryptjs";

const router = express.Router();

/* ================= REGISTER ================= */
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await Parent.findOne({
      $or: [{ email: normalizedEmail }, { phone }],
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "User already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const parent = await Parent.create({
      name,
      email: normalizedEmail,
      phone,
      password: hashedPassword,
    });

    // 🔥 REMOVE PASSWORD
    const parentObj = parent.toObject();
    delete parentObj.password;

    console.log("✅ Registered:", parentObj.email);

    return res.status(201).json({
      success: true,
      data: parentObj, // ✅ IMPORTANT FIX
    });

  } catch (err) {
    console.error("❌ REGISTER ERROR:", err);

    res.status(500).json({
      success: false,
      message: err.message || "Signup failed",
    });
  }
});

/* ================= LOGIN ================= */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 🔥 IMPORTANT: select password
    const parent = await Parent.findOne({ email: normalizedEmail }).select("+password");

    if (!parent) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const isMatch = await bcrypt.compare(password, parent.password);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const parentObj = parent.toObject();
    delete parentObj.password;

    console.log("✅ Login success:", parentObj.email);

    return res.json({
      success: true,
      data: parentObj, // ✅ IMPORTANT FIX
    });

  } catch (err) {
    console.error("❌ LOGIN ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
});

/* ================= SAVE FCM TOKEN ================= */
router.post("/save-token", async (req, res) => {
  try {
    const { parentId, driverId, token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Token is required",
      });
    }

    if (parentId) {
      await Parent.findByIdAndUpdate(parentId, {
        fcmToken: token,
      });
    }

    if (driverId) {
      await Driver.findOneAndUpdate(
        { driverId },
        { fcmToken: token }
      );
    }

    res.json({
      success: true,
      message: "FCM token saved successfully",
    });

  } catch (err) {
    console.error("❌ SAVE TOKEN ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Failed to save token",
    });
  }
});

/* ================= DASHBOARD ================= */
router.get("/dashboard/:parentId", async (req, res) => {
  try {
    const { parentId } = req.params;

    const parent = await Parent.findById(parentId);

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: "Parent not found",
      });
    }

    if (!parent.driverId) {
      return res.json({
        success: true,
        data: [],
      });
    }

    const trips = await Trip.find({ driverId: parent.driverId })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: trips,
    });

  } catch (err) {
    console.error("❌ DASHBOARD ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard",
    });
  }
});

/* ================= LINK DRIVER ================= */
router.post("/link-driver", async (req, res) => {
  try {
    const { parentId, driverId } = req.body;

    if (!parentId || !driverId) {
      return res.status(400).json({
        success: false,
        message: "parentId and driverId required",
      });
    }

    const cleanDriverId = driverId.trim();

    const driver = await Driver.findOne({ driverId: cleanDriverId });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    const updatedParent = await Parent.findByIdAndUpdate(
      parentId,
      { driverId: cleanDriverId },
      { new: true }
    );

    res.json({
      success: true,
      message: "Driver linked successfully",
      data: updatedParent,
    });

  } catch (err) {
    console.error("❌ LINK DRIVER ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Linking failed",
    });
  }
});

export default router;
