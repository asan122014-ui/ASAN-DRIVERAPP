import express from "express";
import twilio from "twilio";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

import Driver from "../models/Driver.js";
import Parent from "../models/Parent.js";

dotenv.config();
const router = express.Router();

/* ================= TWILIO ================= */
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/* ================= MAIL ================= */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/* ================= OTP STORE ================= */
const otpStore = new Map();

/*
type: "login" | "signup"
method: "phone" | "email"
role: "driver" | "parent"
*/

/* ================= SEND OTP ================= */
router.post("/send-otp", async (req, res) => {
  try {
    const { phone, email, type, method, role } = req.body;

    if (!type || !method || !role) {
      return res.status(400).json({
        success: false,
        message: "type, method, role required"
      });
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    /* ================= DRIVER ================= */
    if (role === "driver") {
      if (!phone) {
        return res.status(400).json({ message: "Phone required" });
      }

      const existingDriver = await Driver.findOne({ phone });

      if (type === "login" && !existingDriver) {
        return res.status(404).json({
          message: "Driver not found. Please sign up."
        });
      }

      if (type === "signup" && existingDriver) {
        return res.status(400).json({
          message: "Phone already registered"
        });
      }

      otpStore.set(phone, {
        otp,
        expires: Date.now() + 5 * 60 * 1000
      });

      await twilioClient.messages.create({
        body: `Your ASAN OTP is ${otp}`,
        from: process.env.TWILIO_PHONE,
        to: `+91${phone}`
      });

      return res.json({ success: true, message: "OTP sent to phone" });
    }

    /* ================= PARENT ================= */
    if (role === "parent") {
      if (!email) {
        return res.status(400).json({ message: "Email required" });
      }

      const existingParent = await Parent.findOne({ email });

      if (type === "login" && !existingParent) {
        return res.status(404).json({
          message: "Account not found. Please sign up."
        });
      }

      if (type === "signup" && existingParent) {
        return res.status(400).json({
          message: "Email already registered"
        });
      }

      otpStore.set(email, {
        otp,
        expires: Date.now() + 5 * 60 * 1000
      });

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "ASAN Parent OTP",
        html: `<h2>Your OTP is ${otp}</h2>`
      });

      return res.json({ success: true, message: "OTP sent to email" });
    }

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
    const { phone, email, otp, type, role } = req.body;

    const key = role === "driver" ? phone : email;
    const stored = otpStore.get(key);

    if (!stored || stored.expires < Date.now()) {
      otpStore.delete(key);

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

    otpStore.delete(key);

    /* ================= DRIVER LOGIN ================= */
    if (role === "driver" && type === "login") {
      const driver = await Driver.findOne({ phone });

      if (!driver) {
        return res.status(404).json({
          message: "Driver not found"
        });
      }

      if (driver.status !== "approved") {
        return res.status(403).json({
          message: "Not approved yet"
        });
      }

      const data = driver.toObject();
      delete data.password;

      return res.json({ success: true, driver: data });
    }

    /* ================= PARENT LOGIN ================= */
    if (role === "parent" && type === "login") {
      const parent = await Parent.findOne({ email });

      if (!parent) {
        return res.status(404).json({
          message: "Parent not found"
        });
      }

      const data = parent.toObject();
      delete data.password;

      return res.json({ success: true, parent: data });
    }

    /* ================= SIGNUP ================= */
    return res.json({
      success: true,
      message: "OTP verified"
    });

  } catch (error) {
    console.error("Verify OTP error:", error.message);

    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

export default router;
