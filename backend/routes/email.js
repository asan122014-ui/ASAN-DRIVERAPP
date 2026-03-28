import express from "express";
import Otp from "../models/Otp.js";
import { sendOtpEmail } from "../utils/sendEmail.js";

const router = express.Router();

/* ================= SEND OTP ================= */
router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;

    const otp = Math.floor(1000 + Math.random() * 9000).toString();

    await Otp.create({
      email,
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000 // 5 mins
    });

    await sendOtpEmail(email, otp);

    res.json({ success: true, message: "OTP sent" });

  } catch (err) {
    res.status(500).json({ message: "Failed to send OTP" });
  }
});

/* ================= VERIFY OTP ================= */
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    const record = await Otp.findOne({ email, otp });

    if (!record) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (record.expiresAt < Date.now()) {
      return res.status(400).json({ message: "OTP expired" });
    }

    await Otp.deleteMany({ email }); // cleanup

    res.json({
      success: true,
      message: "OTP verified"
    });

  } catch (err) {
    res.status(500).json({ message: "Verification failed" });
  }
});

export default router;
