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

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const parent = await Parent.create({
      name,
      email: normalizedEmail,
      phone,
      password: hashedPassword,
    });

    parent.password = undefined;

    res.status(201).json({
      success: true,
      data: parent,
    });

  } catch (err) {
    console.error("REGISTER ERROR:", err);

    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Duplicate email or phone",
      });
    }

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

    const parent = await Parent.findOne({ email: normalizedEmail })
      .select("+password");

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

    parent.password = undefined;

    res.json({
      success: true,
      data: parent,
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
});

/* ================= SAVE FCM TOKEN (🔥 UPDATED) ================= */
router.post("/save-token", async (req, res) => {
  try {
    const { parentId, driverId, token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Token is required",
      });
    }

    // ✅ SAVE FOR PARENT
    if (parentId) {
      const parent = await Parent.findByIdAndUpdate(
        parentId,
        { fcmToken: token },
        { new: true }
      );

      if (!parent) {
        return res.status(404).json({
          success: false,
          message: "Parent not found",
        });
      }
    }

    // ✅ SAVE FOR DRIVER
    if (driverId) {
      const driver = await Driver.findOneAndUpdate(
        { driverId },
        { fcmToken: token },
        { new: true }
      );

      if (!driver) {
        return res.status(404).json({
          success: false,
          message: "Driver not found",
        });
      }
    }

    res.json({
      success: true,
      message: "FCM token saved successfully",
    });

  } catch (err) {
    console.error("SAVE TOKEN ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Failed to save token",
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
        success: false,
        message: "Email not found",
      });
    }

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({
      success: false,
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
        success: false,
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
      success: false,
      message: "Server error",
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
    console.error("DASHBOARD ERROR:", err);
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
