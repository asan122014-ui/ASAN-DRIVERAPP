import express from "express";
import twilio from "twilio";
import dotenv from "dotenv";
import Driver from "../models/Driver.js";
import jwt from "jsonwebtoken";

dotenv.config();

const router = express.Router();

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Temporary OTP store
const otpStore = {};

// ================= SEND OTP =================
router.post("/send-otp", async (req, res) => {
  try {
    const { phone, type } = req.body;

    const existingDriver = await Driver.findOne({ phone });

    // LOGIN FLOW
    if (type === "login" && !existingDriver) {
      return res.status(404).json({
        message: "Account not found. Please sign up.",
      });
    }

    // SIGNUP FLOW
    if (type === "signup" && existingDriver) {
      return res.status(400).json({
        message: "Phone already registered. Please login.",
      });
    }

    // ✅ Generate OTP FIRST
    const otp = Math.floor(1000 + Math.random() * 9000);
    otpStore[phone] = {
  otp,
  expires: Date.now() + 5 * 60 * 1000
};

    // ✅ Then log it
    console.log("Generated OTP:", otp);
    console.log("Twilio initialized");

    await client.messages.create({
      body: `Your ASAN OTP is ${otp}`,
      from: process.env.TWILIO_PHONE,
      to: `+91${phone}`,
    });

    res.json({ success: true });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to send OTP" });
  }
});

// ================= VERIFY OTP =================
router.post("/verify-otp", async (req, res) => {
  try {
    const { phone, otp, type } = req.body;
    console.log("Stored OTP:", otpStore[phone]);
    console.log("Entered OTP:", otp);
    

    if (!otpStore[phone]) {
  return res.status(400).json({ message: "OTP expired or not found" });
}

if (otpStore[phone].expires < Date.now()) {
  delete otpStore[phone];
  return res.status(400).json({ message: "OTP expired" });
}

if (otpStore[phone].otp != otp) {
  return res.status(400).json({ message: "Invalid OTP" });
}

    delete otpStore[phone];

    // LOGIN FLOW
    if (type === "login") {
      const driver = await Driver.findOne({ phone });

      if (!driver) {
        return res.status(404).json({ message: "Driver not found" });
      }

      const token = jwt.sign(
        { id: driver._id },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      const { password, ...driverData } = driver.toObject();

return res.json({
  token,
  driver: driverData
});
    }

    // SIGNUP FLOW
    if (type === "signup") {
      return res.json({ success: true });
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
