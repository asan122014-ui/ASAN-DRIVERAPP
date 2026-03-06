import express from "express";
import Driver from "../models/Driver.js";
import verifyToken from "../middleware/auth.js";

const router = express.Router();

console.log("Driver dashboard routes loaded");

// ================= DRIVER DASHBOARD =================
router.get("/dashboard", verifyToken, async (req, res) => {
  try {

    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token"
      });
    }

    const driver = await Driver.findById(req.user.id).select(
      "name vehicleNumber vehicleType rating totalTrips todayTrips studentsAssigned status"
    );

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        name: driver.name,
        vehicleNumber: driver.vehicleNumber || "-",
        vehicleType: driver.vehicleType || "-",
        rating: driver.rating ?? 0,
        totalTrips: driver.totalTrips ?? 0,
        todayTrips: driver.todayTrips ?? 0,
        studentsAssigned: driver.studentsAssigned ?? 0,
        status: driver.status   // ⭐ ALWAYS RETURN STATUS
      }
    });

  } catch (error) {
    console.error("Dashboard Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});

// ================= DRIVER PROFILE =================
router.get("/profile", verifyToken, async (req, res) => {
  try {

    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token"
      });
    }

    const driver = await Driver
      .findById(req.user.id)
      .select("-password");

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: driver
    });

  } catch (error) {
    console.error("Profile Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
});

export default router;
