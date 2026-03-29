import express from "express";
import Driver from "../models/Driver.js";
import mongoose from "mongoose";

const router = express.Router();

/* ================= DRIVER DASHBOARD ================= */
router.get("/dashboard", async (req, res) => {
  try {
    const { driverId } = req.query;

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: "Driver ID required"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(driverId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid driverId"
      });
    }

    const driver = await Driver.findById(driverId).select("-password");

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found"
      });
    }

    res.json({
      success: true,
      data: driver
    });

  } catch (error) {
    console.error("Dashboard error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to load dashboard"
    });
  }
});

/* ================= DRIVER PROFILE ================= */
router.get("/profile", async (req, res) => {
  try {
    const { driverId } = req.query;

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: "driverId required"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(driverId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid driverId"
      });
    }

    const driver = await Driver.findById(driverId)
      .select("-password")
      .lean();

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found"
      });
    }

    res.status(200).json({
      success: true,
      data: driver
    });

  } catch (error) {
    console.error("Driver profile error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to load profile"
    });
  }
});

/* ================= NEW: DRIVER FOR TRACKING ================= */
/* 👉 This is what your frontend will call */

router.get("/tracking", async (req, res) => {
  try {
    const { driverId } = req.query;

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: "driverId required"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(driverId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid driverId"
      });
    }

    const driver = await Driver.findById(driverId)
      .select("name phone vehicleNumber") // 🔥 only needed fields
      .lean();

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found"
      });
    }

    res.status(200).json({
      success: true,
      data: driver
    });

  } catch (error) {
    console.error("Tracking driver error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to fetch driver for tracking"
    });
  }
});

export default router;
