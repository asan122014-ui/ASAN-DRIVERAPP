import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import twilio from "twilio";

import Driver from "../models/Driver.js";
import { upload } from "../config/cloudinary.js";

const router = express.Router();

/* ================= TWILIO ================= */

const client = twilio(
  process.env.TWILIO_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/* ================= TEMP OTP STORE ================= */

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
          message: "All required fields must be filled"
        });
      }

      const existingDriver = await Driver.findOne({
        $or: [{ email }, { phone }]
      });

      if (existingDriver) {
        return res.status(400).json({
          success: false,
          message: "Driver already registered"
        });
      }

      /* ===== CHECK FILES ===== */

      const requiredFiles = [
        "licenseFront",
        "licenseBack",
        "rcFront",
        "rcBack",
        "insurance",
        "idFront",
        "idBack",
        "profilePhoto"
      ];

      for (const file of requiredFiles) {
        if (!req.files?.[file]) {
          return res.status(400).json({
            success: false,
            message: `Missing document: ${file}`
          });
        }
      }

      /* ===== CREATE DRIVER ===== */

      const driver = new Driver({
        name,
        phone,
        email,
        password,   // model will hash
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
        {
          id: driver._id,
          role: "driver"
        },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      const driverResponse = driver.toObject();
      delete driverResponse.password;

      res.status(201).json({
        success: true,
        message: "Driver registered successfully",
        token,
        driver: driverResponse
      });

    } catch (error) {

      console.error("Driver signup error:", error);

      res.status(500).json({
        success: false,
        message: "Driver registration failed"
      });

    }

  }
);

/* ================= DRIVER LOGIN ================= */

router.post("/login", async (req, res) => {

  try {

    const { email, password } = req.body;

    const driver = await Driver.findOne({ email });

    if (!driver) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    if (driver.status !== "approved") {
      return res.status(403).json({
        success: false,
        message: "Your account is not approved yet"
      });
    }

    const isMatch = await bcrypt.compare(password, driver.password);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    const accessToken = jwt.sign(
{
  id: driver._id,
  role: "driver"
},
process.env.JWT_SECRET,
{ expiresIn: "15m" }
);

const refreshToken = jwt.sign(
{
  id: driver._id
},
process.env.JWT_REFRESH_SECRET,
{ expiresIn: "30d" }
);

    const driverResponse = driver.toObject();
    delete driverResponse.password;

    res.json({
  success: true,
  accessToken,
  refreshToken,
  driver: driverResponse
});

  } catch (error) {

    console.error("Driver login error:", error);

    res.status(500).json({
      success: false,
      message: "Login failed"
    });

  }

});

/* ================= SEND OTP ================= */

router.post("/send-otp", async (req, res) => {

  try {

    const { phone } = req.body;

    const otp = Math.floor(1000 + Math.random() * 9000);

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

    console.error("OTP send error:", error);

    res.status(500).json({
      success: false,
      message: "OTP send failed"
    });

  }

});

/* ================= VERIFY OTP ================= */

router.post("/verify-otp", (req, res) => {

  const { phone, otp } = req.body;

  const stored = otpStore.get(phone);

  if (!stored) {
    return res.status(400).json({
      success: false,
      message: "OTP expired"
    });
  }

  if (stored.expires < Date.now()) {
    otpStore.delete(phone);
    return res.status(400).json({
      success: false,
      message: "OTP expired"
    });
  }

  if (stored.otp == otp) {

    otpStore.delete(phone);

    return res.json({
      success: true,
      message: "OTP verified"
    });

  }

  res.status(400).json({
    success: false,
    message: "Invalid OTP"
  });

});

/* ================= GET DRIVER BY DRIVER ID ================= */

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

    res.json({
      success: true,
      driver
    });

  } catch (error) {

    console.error("Get driver error:", error);

    res.status(500).json({
      success: false,
      message: "Server error"
    });

  }

});

export default router;
