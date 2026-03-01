import express from "express";
import Driver from "../models/Driver.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import twilio from "twilio";
import upload from "../middleware/upload.js";

const router = express.Router();

const client = twilio(
  process.env.TWILIO_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// ================= SIGNUP WITH FILE UPLOAD =================
router.post(
  "/signup",
  upload.fields([
    { name: "license" },
    { name: "rc" },
    { name: "insurance" },
    { name: "idImage" },
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
        licenseNumber,
      } = req.body;

      console.log("REQ BODY:", req.body); // 🔥 Add this for debugging

      const existingDriver = await Driver.findOne({ email });
      if (existingDriver) {
        return res.status(400).json({ message: "Driver already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const driverId = `ASAN-${Math.floor(
        100000 + Math.random() * 900000
      )}`;

      const driver = new Driver({
  name,
  phone,
  email,
  password: hashedPassword,
  address,
  license: req.files?.license?.[0]?.path,
  rc: req.files?.rc?.[0]?.path,
  insurance: req.files?.insurance?.[0]?.path,
  idImage: req.files?.idImage?.[0]?.path,
  vehicleNumber,
  vehicleType,
  licenseNumber,
});

const shortId = driver._id.toString().slice(-6).toUpperCase();
driver.driverId = `ASAN-${shortId}`;

await driver.save();

console.log("Generated Driver ID:", driver.driverId);

const token = jwt.sign(
  { id: driver._id },
  process.env.JWT_SECRET,
  { expiresIn: "7d" }
);

res.status(201).json({
  message: "Signup successful",
  token,
  driver,
});

    } catch (error) {
      console.error(error);
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