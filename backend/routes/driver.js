import express from "express";
import Driver from "../models/Driver.js";
import verifyToken from "../middleware/auth.js";

const router = express.Router();

/* ================= DRIVER DASHBOARD ================= */

router.get("/dashboard", verifyToken, async (req, res) => {
  try {

    const driverId = req.user?.id;

    if (!driverId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access"
      });
    }

    const driver = await Driver.findById(driverId).select(
      "name vehicleNumber vehicleType rating totalTrips todayTrips studentsAssigned status"
    );

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
        vehicleNumber: driver.vehicleNumber || "-",
        vehicleType: driver.vehicleType || "-",
        rating: driver.rating ?? 0,
        totalTrips: driver.totalTrips ?? 0,
        todayTrips: driver.todayTrips ?? 0,
        studentsAssigned: driver.studentsAssigned ?? 0,
        status: driver.status
      }
    });

  } catch (error) {

    console.error("Driver dashboard error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load dashboard"
    });

  }
});

/* ================= DRIVER PROFILE ================= */

router.get("/profile", verifyToken, async (req, res) => {
  try {

    const driverId = req.user?.id;

    if (!driverId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access"
      });
    }

    const driver = await Driver
      .findById(driverId)
      .select("-password");

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

    console.error("Driver profile error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load profile"
    });

  }
});

export default router;
