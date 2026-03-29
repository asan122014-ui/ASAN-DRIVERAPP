import express from "express";
import mongoose from "mongoose";
import Driver from "../models/Driver.js";

const router = express.Router();

/* ================= HELPER FUNCTION ================= */
const findDriver = async (driverId) => {
  // ✅ support BOTH Mongo _id and ASAN driverId
  if (mongoose.Types.ObjectId.isValid(driverId)) {
    return await Driver.findById(driverId);
  } else {
    return await Driver.findOne({ driverId });
  }
};

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

    const driver = await findDriver(driverId);

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

    const driver = await findDriver(driverId);

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
    console.error("Driver profile error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to load profile"
    });
  }
});

/* ================= DRIVER TRACKING ================= */
router.get("/tracking", async (req, res) => {
  try {
    const { driverId } = req.query;

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: "driverId required"
      });
    }

    const driver = await findDriver(driverId);

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found"
      });
    }

    res.json({
      success: true,
      data: {
        name: driver.name,
        phone: driver.phone,
        vehicleNumber: driver.vehicleNumber
      }
    });

  } catch (error) {
    console.error("Tracking error:", error.message);
    res.status(500).json({
      success: false,
      message: "Tracking failed"
    });
  }
});

/* ================= UPDATE DRIVER PROFILE ================= */
router.put("/update", async (req, res) => {
  try {
    const { driverId, ...updates } = req.body;

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: "Driver ID required"
      });
    }

    const driver = await findDriver(driverId);

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found"
      });
    }

    Object.assign(driver, updates);
    await driver.save();

    res.json({
      success: true,
      message: "Driver updated",
      data: driver
    });

  } catch (error) {
    console.error("Update error:", error.message);
    res.status(500).json({
      success: false,
      message: "Update failed"
    });
  }
});

/* ================= GET DRIVER BY ID PARAM ================= */
router.get("/:id", async (req, res) => {
  try {
    const driver = await findDriver(req.params.id);

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
    console.error("Get driver error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch driver"
    });
  }
});

export default router;
