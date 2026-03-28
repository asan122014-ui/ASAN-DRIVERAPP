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
    const { phone, type } = req.body;
    if (!phone || !type) {
      return res.status(400).json({
        success: false,
        message: "Phone and type required"
      });
    }
    if (!["login", "signup"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP type"
      });
    }
    const existingDriver = await Driver.findOne({ phone });
    if (type === "login" && !existingDriver) {
      return res.status(404).json({
        success: false,
        message: "Account not found. Please sign up."
      });
    }
    if (type === "signup" && existingDriver) {
      return res.status(400).json({
        success: false,
        message: "Phone already registered"
      });
    }
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    otpStore.set(phone, {
      otp,
      expires: Date.now() + 5 * 60 * 1000
    });
    await client.messages.create({
      body: `Your ASAN OTP is ${otp}`,
      from: process.env.TWILIO_PHONE,
      to: `+91${phone}`
    });
    res.json({
      success: true,
      message: "OTP sent"
    });
  } catch (error) {
    console.error("Send OTP error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to send OTP"
    });
  }
});
/* ================= VERIFY OTP ================= */
router.post("/verify-otp", async (req, res) => {
  try {
    const { phone, otp, type } = req.body;
    const stored = otpStore.get(phone);
    if (!stored || stored.expires < Date.now()) {
      otpStore.delete(phone);
      return res.status(400).json({
        success: false,
        message: "OTP expired"
      });
    }
    if (stored.otp !== otp.toString()) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP"
      });
    }
    otpStore.delete(phone);
    /* ================= LOGIN ================= */
    if (type === "login") {
      const driver = await Driver.findOne({ phone });
      if (!driver) {
        return res.status(404).json({
          success: false,
          message: "Driver not found"
        });
      }
      if (driver.status !== "approved") {
        return res.status(403).json({
          success: false,
          message: "Not approved yet"
        });
      }
      const data = driver.toObject();
      delete data.password;
      return res.json({
        success: true,
        driver: data
      });
    }
    /* ================= SIGNUP ================= */
    if (type === "signup") {
      return res.json({
        success: true,
        message: "OTP verified"
      });
    }
  } catch (error) {
    console.error("Verify OTP error:", error.message);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});
export default router;
