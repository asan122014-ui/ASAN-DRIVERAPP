import express from "express";
import Driver from "../models/Driver.js";
import verifyToken from "../middleware/auth.js";

const router = express.Router();
console.log("Driver dashboard routes loaded");

// Get Driver Dashboard Data
router.get("/dashboard", verifyToken, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Invalid token payload" });
    }

    const driver = await Driver.findById(req.user.id);

    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    res.json({
      name: driver.name,
      vehicleNumber: driver.vehicleNumber || "-",
      vehicleType: driver.vehicleType || "-",
      rating: driver.rating || 0,
      totalTrips: driver.totalTrips || 0,
      todayTrips: driver.todayTrips || 0,
      studentsAssigned: driver.studentsAssigned || 0,
    });

  } catch (err) {
    console.error("Dashboard Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
});
// Get Driver Profile
router.get("/profile", verifyToken, async (req, res) => {
  try {
    const driver = await Driver.findById(req.user.id);

    if (!driver) {
      return res.status(404).json({ message: "Driver not found" });
    }

    res.json(driver);

  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});

export default router;