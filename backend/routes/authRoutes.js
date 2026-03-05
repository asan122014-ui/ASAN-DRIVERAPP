import express from "express";
import Driver from "../models/Driver.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import twilio from "twilio";
import { upload } from "../config/cloudinary.js";

const router = express.Router();

const client = twilio(
  process.env.TWILIO_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// ================= SIGNUP WITH FILE UPLOAD =================
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

      const existingDriver = await Driver.findOne({
  $or: [{ email }, { phone }]
});

if (existingDriver) {
  return res.status(400).json({
    message: "Driver already registered"
  });
}

      if (existingDriver) {
        return res.status(400).json({ message: "Driver already exists" });
      }

      if (
        !req.files?.licenseFront ||
        !req.files?.licenseBack ||
        !req.files?.rcFront ||
        !req.files?.rcBack ||
        !req.files?.insurance ||
        !req.files?.idFront ||
        !req.files?.idBack ||
        !req.files?.profilePhoto
      ) {
        return res.status(400).json({ message: "All documents are required" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const driver = new Driver({
        name,
        phone,
        email,
        password: hashedPassword,
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

      const shortId = driver._id.toString().slice(-6).toUpperCase();
      driver.driverId = `ASAN-${shortId}`;

      await driver.save();

      const token = jwt.sign(
        { id: driver._id },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      res.status(201).json({
        message: "Signup successful",
        token,
        driver
      });

    } catch (error) {
      console.error("Signup Error:", error);
      res.status(500).json({ message: "Server Error" });
    }
  }
);

// ================= LOGIN =================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const driver = await Driver.findOne({ email });
    if (!driver) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, driver.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: driver._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token, driver });

  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
});

// ================= SEND OTP =================
router.post("/send-otp", async (req, res) => {
  try {
    const { phone } = req.body;

    const otp = Math.floor(1000 + Math.random() * 9000);

    global.otpStore = { phone, otp }; // temporary storage

    await client.messages.create({
      body: `Your ASAN OTP is ${otp}`,
      from: process.env.TWILIO_PHONE,
      to: `+91${phone}`,
    });

    res.json({ success: true });

  } catch (error) {
    res.status(500).json({ message: "OTP Failed" });
  }
});

// ================= VERIFY OTP =================
router.post("/verify-otp", (req, res) => {
  const { phone, otp } = req.body;

  if (
    global.otpStore &&
    global.otpStore.phone === phone &&
    global.otpStore.otp == otp
  ) {
    return res.json({ success: true });
  }

  res.status(400).json({ message: "Invalid OTP" });
});
router.get("/by-id/:driverId", async (req, res) => {
  try {
    const driver = await Driver.findOne({ driverId: req.params.driverId });

    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    res.json(driver);

  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});

export default router;
