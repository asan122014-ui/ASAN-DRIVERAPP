import express from "express";
import Driver from "../models/Driver.js";

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

router.get("/profile/:driverId", async (req, res) => {

  try {

    const driverId = req.params.driverId;

    if (!driverId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access"
      });
    }

    const driver = await Driver
      .findById(driverId)
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

    console.error("Driver profile error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load profile"
    });

  }

});

export default router;
