import express from "express";
import bcrypt from "bcryptjs";
import twilio from "twilio";
import Driver from "../models/Driver.js";
import Parent from "../models/Parent.js"; // 🔥 IMPORTANT
import { upload } from "../config/cloudinary.js";

const router = express.Router();

/* ================= TWILIO ================= */
const client = twilio(
  process.env.TWILIO_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/* ================= OTP STORE ================= */
const otpStore = new Map();

/* ================= DRIVER SIGNUP ================= */
router.post(
  "/signup",
  upload.fields([
    { name: "licenseFront", maxCount: 1 },
    { name: "licenseBack", maxCount: 1 },
    { name: "rcFront", maxCount: 1 },
    { name: "rcBack", maxCount: 1 },
    { name: "insurance", maxCount: 1 },
    { name: "idFront", maxCount: 1 },
    { name: "idBack", maxCount: 1 },
    { name: "profilePhoto", maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const {
        name,
        phone,
        email,
        password,
        address,
        vehicleNumber,
        vehicleType,
        licenseNumber
      } = req.body;

      if (!name || !phone || !email || !password || !address || !vehicleNumber || !vehicleType || !licenseNumber) {
        return res.status(400).json({
          success: false,
          message: "All fields required"
        });
      }

      const existing = await Driver.findOne({
        $or: [{ email }, { phone }]
      });

      if (existing) {
        return res.status(400).json({
          success: false,
          message: "Driver already exists"
        });
      }

      const driver = new Driver({
        name,
        phone,
        email,
        password,
        address,
        vehicleNumber,
        vehicleType,
        licenseNumber,
        licenseFront: req.files.licenseFront[0].path,
        licenseBack: req.files.licenseBack[0].path,
        rcFront: req.files.rcFront[0].path,
        rcBack: req.files.rcBack[0].path,
        insurance: req.files.insurance[0].path,
        idFront: req.files.idFront[0].path,
        idBack: req.files.idBack[0].path,
        profilePhoto: req.files.profilePhoto[0].path,
        status: "pending"
      });

      driver.driverId = `ASAN-${driver._id.toString().slice(-6).toUpperCase()}`;

      await driver.save();

      const data = driver.toObject();
      delete data.password;

      res.status(201).json({
        success: true,
        message: "Signup successful",
        driver: data
      });

    } catch (error) {
      console.error(error);
      res.status(500).json({
        success: false,
        message: "Signup failed"
      });
    }
  }
);

/* ================= LOGIN ================= */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const driver = await Driver.findOne({ email }).select("+password");

    if (!driver) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    if (driver.status !== "approved") {
      return res.status(403).json({
        success: false,
        message: "Not approved yet"
      });
    }

    const isMatch = await driver.comparePassword(password);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    const data = driver.toObject();
    delete data.password;

    res.json({
      success: true,
      driver: data
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Login failed"
    });
  }
});

/* ================= SAVE FCM TOKEN (🔥 NEW) ================= */
router.post("/save-token", async (req, res) => {
  try {
    const { parentId, fcmToken } = req.body;

    if (!parentId || !fcmToken) {
      return res.status(400).json({
        success: false,
        message: "Missing parentId or fcmToken",
      });
    }

    const parent = await Parent.findByIdAndUpdate(
      parentId,
      { fcmToken },
      { new: true }
    );

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: "Parent not found",
      });
    }

    console.log("✅ FCM token saved for parent:", parentId);

    res.json({
      success: true,
      message: "Token saved successfully",
    });

  } catch (error) {
    console.error("❌ Save token error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save token",
    });
  }
});

/* ================= OTP ================= */
router.post("/send-otp", async (req, res) => {
  try {
    const { phone } = req.body;

    const otp = Math.floor(1000 + Math.random() * 9000);

    otpStore.set(phone, {
      otp,
      expires: Date.now() + 5 * 60 * 1000
    });

    await client.messages.create({
      body: `Your OTP is ${otp}`,
      from: process.env.TWILIO_PHONE,
      to: `+91${phone}`
    });

    res.json({ success: true, message: "OTP sent" });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "OTP failed"
    });
  }
});

router.post("/verify-otp", (req, res) => {
  const { phone, otp } = req.body;

  const stored = otpStore.get(phone);

  if (!stored || stored.expires < Date.now()) {
    return res.status(400).json({
      success: false,
      message: "OTP expired"
    });
  }

  if (stored.otp == otp) {
    otpStore.delete(phone);
    return res.json({ success: true });
  }

  res.status(400).json({
    success: false,
    message: "Invalid OTP"
  });
});

/* ================= GET DRIVER ================= */
router.get("/by-id/:driverId", async (req, res) => {
  try {
    const driver = await Driver
      .findOne({ driverId: req.params.driverId })
      .select("-password");

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found"
      });
    }

    res.json({ success: true, driver });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

export default router;
