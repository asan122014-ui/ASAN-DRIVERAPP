import express from "express";
import twilio from "twilio";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
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

// Email (Gmail)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

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

    // normalize
    if (email) email = email.trim().toLowerCase();
    if (phone) phone = phone.trim();

    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    /* ================= EMAIL (PARENT) ================= */
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

      // ✅ FAST RESPONSE FIRST
      res.json({
        success: true,
        message: "OTP sent to email"
      });

      // ✅ SEND EMAIL IN BACKGROUND
      transporter.sendMail({
        from: `"ASAN" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "ASAN OTP Verification",
        text: `Your OTP is ${otp}`
      }).catch(err => console.error("Email error:", err));

      return;
    }

    /* ================= PHONE (DRIVER) ================= */
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

      // ✅ FAST RESPONSE
      res.json({
        success: true,
        message: "OTP sent to phone"
      });

      // ✅ SEND SMS IN BACKGROUND
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
