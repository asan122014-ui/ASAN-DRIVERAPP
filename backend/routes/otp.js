import express from "express";
import twilio from "twilio";
import dotenv from "dotenv";
import { Resend } from "resend";

import Driver from "../models/Driver.js";
import Parent from "../models/Parent.js";

dotenv.config();

const router = express.Router();

/* ================= SERVICES ================= */

// Twilio (SMS)
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Resend (Email)
const resend = new Resend(process.env.RESEND_API_KEY);

/* ================= OTP STORE ================= */
const otpStore = new Map();

/* ================= SEND OTP ================= */
router.post("/send-otp", async (req, res) => {
  try {
    let { phone, email, type } = req.body;

    if (!type) {
      return res.status(400).json({
        success: false,
        message: "Type required"
      });
    }

    // normalize input
    if (email) email = email.trim().toLowerCase();
    if (phone) phone = phone.trim();

    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    /* ================= EMAIL OTP (PARENT) ================= */
    if (email) {
      const parent = await Parent.findOne({ email });

      if (type === "parent_login" && !parent) {
        return res.status(404).json({
          success: false,
          message: "Parent not found"
        });
      }

      if (type === "parent_signup" && parent) {
        return res.status(400).json({
          success: false,
          message: "Email already registered"
        });
      }

      // store OTP
      otpStore.set(email, {
        otp,
        expires: Date.now() + 5 * 60 * 1000
      });

      console.log("EMAIL OTP:", otp);

      // ✅ instant response
      res.json({
        success: true,
        message: "OTP sent to email"
      });

      // ✅ send email in background (NO BLOCKING)
      resend.emails.send({
        from: "ASAN <onboarding@resend.dev>",
        to: email,
        subject: "ASAN OTP Verification",
        html: `
          <div style="font-family: Arial;">
            <h2>ASAN Verification</h2>
            <p>Your OTP is:</p>
            <h1 style="color:#f59e0b;">${otp}</h1>
            <p>This OTP expires in 5 minutes.</p>
          </div>
        `
      }).catch(err => console.error("Resend error:", err));

      return;
    }

    /* ================= PHONE OTP (DRIVER) ================= */
    if (phone) {
      const driver = await Driver.findOne({ phone });

      if (type === "driver_login" && !driver) {
        return res.status(404).json({
          success: false,
          message: "Driver not found"
        });
      }

      if (type === "driver_signup" && driver) {
        return res.status(400).json({
          success: false,
          message: "Phone already registered"
        });
      }

      otpStore.set(phone, {
        otp,
        expires: Date.now() + 5 * 60 * 1000
      });

      console.log("PHONE OTP:", otp);

      // ✅ instant response
      res.json({
        success: true,
        message: "OTP sent to phone"
      });

      // ✅ send SMS in background
      client.messages.create({
        body: `Your ASAN OTP is ${otp}`,
        from: process.env.TWILIO_PHONE,
        to: `+91${phone}`
      }).catch(err => console.error("SMS error:", err));

      return;
    }

    return res.status(400).json({
      success: false,
      message: "Email or phone required"
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
    let { phone, email, otp, type } = req.body;

    if (email) email = email.trim().toLowerCase();
    if (phone) phone = phone.trim();

    const key = email || phone;

    if (!key) {
      return res.status(400).json({
        success: false,
        message: "Email or phone required"
      });
    }

    const stored = otpStore.get(key);

    console.log("VERIFY:", key, otp, stored);

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

    // remove OTP after success
    otpStore.delete(key);

    /* ===== DRIVER LOGIN ===== */
    if (type === "driver_login") {
      const driver = await Driver.findOne({ phone });

      if (!driver) {
        return res.status(404).json({
          success: false,
          message: "Driver not found"
        });
      }

      const data = driver.toObject();
      delete data.password;

      return res.json({
        success: true,
        driver: data
      });
    }

    /* ===== PARENT LOGIN ===== */
    if (type === "parent_login") {
      const parent = await Parent.findOne({ email });

      if (!parent) {
        return res.status(404).json({
          success: false,
          message: "Parent not found"
        });
      }

      return res.json({
        success: true,
        parent
      });
    }

    /* ===== SIGNUP ===== */
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
