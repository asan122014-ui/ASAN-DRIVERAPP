import express from "express";
import twilio from "twilio";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import Driver from "../models/Driver.js";

dotenv.config();

const router = express.Router();

/* ================= TWILIO CLIENT ================= */

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
        message: "Invalid OTP request type"
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
        message: "Phone already registered. Please login."
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
      message: "OTP sent successfully"
    });

  } catch (error) {

    console.error("Send OTP error:", error);

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

    const storedOtp = otpStore.get(phone);

    if (!storedOtp) {
      return res.status(400).json({
        success: false,
        message: "OTP expired or not found"
      });
    }

    if (storedOtp.expires < Date.now()) {
      otpStore.delete(phone);
      return res.status(400).json({
        success: false,
        message: "OTP expired"
      });
    }

    if (storedOtp.otp !== otp.toString()) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP"
      });
    }

    otpStore.delete(phone);

    /* ================= LOGIN FLOW ================= */

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
          message: "Your account is not approved yet"
        });
      }

      const token = jwt.sign(
        {
          id: driver._id,
          role: "driver"
        },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      const driverData = driver.toObject();
      delete driverData.password;

      return res.json({
        success: true,
        token,
        driver: driverData
      });

    }

    /* ================= SIGNUP FLOW ================= */

    if (type === "signup") {

      return res.json({
        success: true,
        message: "OTP verified"
      });

    }

  } catch (error) {

    console.error("Verify OTP error:", error);

    res.status(500).json({
      success: false,
      message: "Server error"
    });

  }

});

export default router;
