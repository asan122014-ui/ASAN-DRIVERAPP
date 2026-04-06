import express from "express";
import Parent from "../models/Parent.js";
import Driver from "../models/Driver.js";
import Trip from "../models/Trips.js";
import bcrypt from "bcryptjs";

const router = express.Router();

/* ================= REGISTER ================= */
router.post("/register", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "All fields required",
      });
    }

    const existing = await Parent.findOne({
      $or: [{ email }, { phone }],
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Email or phone already registered",
      });
    }

    const parent = await Parent.create({
      name,
      email,
      phone,
      password,
    });

    const data = parent.toObject();
    delete data.password;

    res.status(201).json({
      success: true,
      data,
    });

  } catch (error) {
    console.error("❌ REGISTER ERROR:", error.message);

    res.status(500).json({
      success: false,
      message: error.message,
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

    res.json({
      success: true,
      data: parentObj,
    });
  } catch (err) {
    console.error("❌ LOGIN ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
});

/* ================= SAVE FCM TOKEN (🔥 IMPROVED) ================= */
router.post("/save-token", async (req, res) => {
  try {
    const { parentId, token } = req.body;

    console.log("🔥 Saving token for:", parentId);
    console.log("🔥 Token:", token);

    if (!parentId || !token) {
      return res.status(400).json({
        success: false,
        message: "parentId and token required",
      });
    }

    const updatedParent = await Parent.findByIdAndUpdate(
      parentId,
      {
        $addToSet: { fcmTokens: token }, // ✅ NO duplicates + atomic
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedParent) {
      return res.status(404).json({
        success: false,
        message: "Parent not found",
      });
    }

    console.log("✅ UPDATED TOKENS:", updatedParent.fcmTokens);

    res.json({
      success: true,
      data: updatedParent.fcmTokens,
    });
  } catch (error) {
    console.error("❌ SAVE TOKEN ERROR:", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
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

    res.status(200).json({
      success: true,
      message: "Email verified",
      parentId: parent._id, // optional
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    const parent = await Parent.findOne({
      email: email.trim().toLowerCase(),
    });

    if (!parent) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    parent.password = newPassword; // (hash if using bcrypt)
    await parent.save();

    res.json({
      success: true,
      message: "Password updated",
    });
  } catch (err) {
    res.status(500).json({
      message: "Server error",
    });
  }
});

export default router;
