import express from "express";
import Parent from "../models/Parent.js";
import Driver from "../models/Driver.js";
import Trip from "../models/Trip.js";

const router = express.Router();

/* ================= LINK DRIVER ================= */

router.post("/link-driver", async (req, res) => {
  try {
    const { parentId, driverId } = req.body;

    const driver = await Driver.findOne({ driverId });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found"
      });
    }

    await Parent.findByIdAndUpdate(parentId, {
      driverId
    });

    res.json({
      success: true,
      message: "Driver linked successfully"
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Linking failed"
    });
  }
});

/* ================= DASHBOARD ================= */

router.get("/dashboard/:parentId", async (req, res) => {
  try {
    const parentId = req.params.parentId;

    const trips = await Trip.find({ parentId })
      .populate("driverId", "name driverId");

    res.json({
      success: true,
      data: trips
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard"
    });
  }
});
/* ================= REGISTER ================= */

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // 🔥 TEMP (replace with DB logic)
    if (!name || !email || !password) {
      return res.status(400).json({
        message: "All fields required"
      });
    }

    const parent = {
      _id: Date.now(),
      name,
      email
    };

    res.json({
      success: true,
      data: {
        parent,
        token: "demo-token"
      }
    });

  } catch (err) {
    res.status(500).json({
      message: "Registration failed"
    });
  }
});

export default router;

export default router;
