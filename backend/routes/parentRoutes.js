import express from "express";
import Parent from "../models/Parent.js";
import Driver from "../models/Driver.js";
import Trip from "../models/Trip.js";
import bcrypt from "bcryptjs";

const router = express.Router();

/* ================= REGISTER ================= */
router.post("/register", async (req, res) => {
  try {
    console.log("REQ BODY:", req.body);

    const { name, email, password, phone } = req.body;

    // ✅ VALIDATION
    if (!name || !email || !password || !phone) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // ✅ CHECK EXISTING USER
    const existing = await Parent.findOne({
      $or: [{ email: normalizedEmail }, { phone }],
    });

    if (existing) {
      return res.status(400).json({
        message: "User already exists",
      });
    }

    // ✅ HASH PASSWORD (🔥 FIX)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // ✅ CREATE USER
    const parent = new Parent({
      name,
      email: normalizedEmail,
      phone,
      password: hashedPassword, // ✅ FIXED
    });

    await parent.save();

    // ✅ REMOVE PASSWORD FROM RESPONSE
    parent.password = undefined;

    res.status(201).json({
      success: true,
      data: { parent },
    });

  } catch (err) {
    console.error("REGISTER ERROR:", err);

    if (err.code === 11000) {
      return res.status(400).json({
        message: "Duplicate email or phone",
      });
    }

    res.status(500).json({
      message: err.message || "Signup failed",
    });
  }
});

/* ================= LOGIN ================= */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // ✅ VALIDATION
    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // ✅ FIND USER
    const parent = await Parent.findOne({ email: normalizedEmail }).select("+password");

    if (!parent) {
      return res.status(400).json({
        message: "Invalid credentials",
      });
    }

    // ✅ CHECK PASSWORD
    const isMatch = await bcrypt.compare(password, parent.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid credentials",
      });
    }

    // ✅ REMOVE PASSWORD
    parent.password = undefined;

    res.json({
      success: true,
      data: { parent },
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);

    res.status(500).json({
      message: "Login failed",
    });
  }
});

/* ================= CHECK EMAIL ================= */
router.post("/check-email", async (req, res) => {
  try {
    const { email } = req.body;

    const parent = await Parent.findOne({
      email: email.trim().toLowerCase(),
    });

    if (!parent) {
      return res.status(404).json({
        message: "Email not found",
      });
    }

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({
      message: "Server error",
    });
  }
});

/* ================= RESET PASSWORD ================= */
router.post("/reset-password", async (req, res) => {
  try {
    const { email, password } = req.body;

    const parent = await Parent.findOne({
      email: email.trim().toLowerCase(),
    });

    if (!parent) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const salt = await bcrypt.genSalt(10);
    parent.password = await bcrypt.hash(password, salt);

    await parent.save();

    res.json({
      success: true,
      message: "Password updated",
    });

  } catch (err) {
    console.error("RESET ERROR:", err);

    res.status(500).json({
      message: "Server error",
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
      data: trips,
    });

  } catch (err) {
    console.error("DASHBOARD ERROR:", err);

    res.status(500).json({
      message: "Failed to fetch dashboard",
    });
  }
});

/* ================= LINK DRIVER ================= */
router.post("/link-driver", async (req, res) => {
  try {
    let { parentId, driverId } = req.body;

    // ✅ VALIDATION
    if (!parentId || !driverId) {
      return res.status(400).json({
        success: false,
        message: "parentId and driverId required",
      });
    }

    // ✅ CLEAN INPUT
    driverId = driverId.trim();

    // ✅ CHECK DRIVER
    const driver = await Driver.findOne({ driverId });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    // ✅ UPDATE PARENT + RETURN UPDATED
    const updatedParent = await Parent.findByIdAndUpdate(
      parentId,
      { driverId },
      { new: true } // 🔥 IMPORTANT
    );

    if (!updatedParent) {
      return res.status(404).json({
        success: false,
        message: "Parent not found",
      });
    }

    res.json({
      success: true,
      message: "Driver linked successfully",
      data: updatedParent,
    });

  } catch (err) {
    console.error("LINK DRIVER ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Linking failed",
    });
  }
});

export default router;
