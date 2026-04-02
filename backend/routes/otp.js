import express from "express";
import twilio from "twilio";
import dotenv from "dotenv";
import Driver from "../models/Driver.js";

dotenv.config();
const router = express.Router();

/* ================= TWILIO ================= */
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/* ================= OTP STORE ================= */
const otpStore = new Map();

/* ================= SEND OTP ================= */
router.post("/send-otp", async (req, res) => {
  try {
    console.log("📥 REQ BODY:", req.body); // 🔥 DEBUG

    let { phone, type } = req.body;

    /* ===== VALIDATION ===== */
    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone is required",
      });
    }

    // 🔥 DEFAULT TYPE (prevents 400 errors)
    if (!type) {
      type = "driver_login";
    }

    phone = phone.trim();

    if (!["driver_login", "driver_signup"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid type",
      });
    }

    /* ===== DRIVER CHECK ===== */
    const driver = await Driver.findOne({ phone });

    if (type === "driver_login" && !driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    if (type === "driver_signup" && driver) {
      return res.status(400).json({
        success: false,
        message: "Phone already registered",
      });
    }

    /* ===== GENERATE OTP ===== */
    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    otpStore.set(phone, {
      otp,
      expires: Date.now() + 5 * 60 * 1000, // 5 mins
    });

    console.log("📲 OTP:", otp);

    /* ===== RESPONSE FAST ===== */
    res.json({
      success: true,
      message: "OTP sent successfully",
    });

    /* ===== SEND SMS (BACKGROUND) ===== */
    client.messages
      .create({
        body: `Your ASAN OTP is ${otp}`,
        from: process.env.TWILIO_PHONE,
        to: `+91${phone}`,
      })
      .then(() => console.log("✅ SMS sent"))
      .catch((err) => console.error("❌ SMS error:", err.message));

  } catch (error) {
    console.error("❌ Send OTP error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to send OTP",
    });
  }
});

/* ================= VERIFY OTP ================= */
router.post("/verify-otp", async (req, res) => {
  try {
    console.log("📥 VERIFY BODY:", req.body); // 🔥 DEBUG

    let { phone, otp, type } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: "Phone and OTP required",
      });
    }

    phone = phone.trim();

    const stored = otpStore.get(phone);

    if (!stored || stored.expires < Date.now()) {
      otpStore.delete(phone);

      return res.status(400).json({
        success: false,
        message: "OTP expired",
      });
    }

    if (stored.otp !== otp.toString()) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    otpStore.delete(phone);

    /* ===== DRIVER LOGIN ===== */
    if (type === "driver_login") {
      const driver = await Driver.findOne({ phone });

      if (!driver) {
        return res.status(404).json({
          success: false,
          message: "Driver not found",
        });
      }

      const data = driver.toObject();
      delete data.password;

      return res.json({
        success: true,
        driver: data,
      });
    }

    /* ===== SIGNUP VERIFIED ===== */
    return res.json({
      success: true,
      message: "OTP verified successfully",
    });

  } catch (error) {
    console.error("❌ Verify OTP error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

export default router;
