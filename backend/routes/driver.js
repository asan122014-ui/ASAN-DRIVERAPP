import express from "express";
import mongoose from "mongoose";
import Driver from "../models/Driver.js";
import Trips from "../models/Trips.js";
import Child from "../models/Child.js";
import { cloudinary, upload } from "../config/cloudinary.js";
import sharp from "sharp";
const router = express.Router();

/* ================= HELPER FUNCTION ================= */
const findDriver = async (driverId) => {
  if (mongoose.Types.ObjectId.isValid(driverId)) {
    return await Driver.findById(driverId);
  } else {
    return await Driver.findOne({ driverId });
  }
};

/* ================= SAVE FCM TOKEN (🔥 NEW) ================= */
router.post("/save-token", async (req, res) => {
  try {
    const { driverId, token } = req.body;

    if (!driverId || !token) {
      return res.status(400).json({
        success: false,
        message: "driverId and token required",
      });
    }

    const driver = await Driver.findOneAndUpdate(
      { driverId },
      {
        $addToSet: { fcmTokens: token }, // ✅ multiple devices support
      },
      { new: true }
    );

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    console.log("✅ Driver FCM token saved");

    res.json({
      success: true,
      message: "Token saved successfully",
    });
  } catch (error) {
    console.error("❌ Save token error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save token",
    });
  }
});

/* ================= GET ALL DRIVERS ================= */
router.get("/", async (req, res) => {
  try {
    const drivers = await Driver.find()
      .select("name driverId vehicleNumber")
      .lean();

    res.json({
      success: true,
      data: drivers,
    });
  } catch (error) {
    console.error("Get all drivers error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch drivers",
    });
  }
});

/* ================= SEARCH DRIVERS ================= */
router.get("/search", async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.json({ success: true, data: [] });
    }

    const drivers = await Driver.find({
      $or: [
        { name: { $regex: query, $options: "i" } },
        { phone: { $regex: query, $options: "i" } },
        { driverId: { $regex: query, $options: "i" } },
      ],
    })
      .select("name phone driverId vehicleNumber")
      .limit(10);

    res.json({
      success: true,
      data: drivers,
    });
  } catch (error) {
    console.error("Driver search error:", error);
    res.status(500).json({
      success: false,
      message: "Search failed",
    });
  }
});

/* ================= GET DRIVER LAST LOCATION ================= */
router.get("/location", async (req, res) => {
  try {
    const { driverId } = req.query;

    if (!driverId) {
      return res.status(400).json({
        success: false,
        message: "Driver ID required",
      });
    }

    const driver = await findDriver(driverId);

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    res.json({
      success: true,
      data: {
        lastLocation: driver.lastLocation || null,
      },
    });
  } catch (error) {
    console.error("Get last location error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch driver location",
    });
  }
});

/* ================= DRIVER DASHBOARD ================= */
router.get("/dashboard/:driverId", async (req, res) => {
  try {
    const { driverId } = req.params;

    const driver = await findDriver(driverId);

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalTrips, todayTrips, studentsAssigned] =
      await Promise.all([
        Trips.countDocuments({ driverId }),
        Trips.countDocuments({
          driverId,
          createdAt: { $gte: today },
        }),
        Child.countDocuments({ driverId }),
      ]);

    res.json({
      success: true,
      data: {
        name: driver.name,
        vehicleNumber: driver.vehicleNumber,
        vehicleType: driver.vehicleType,
        totalTrips,
        todayTrips,
        studentsAssigned,
      },
    });
  } catch (error) {
    console.error("Dashboard error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to load dashboard",
    });
  }
});

/* ================= DRIVER PROFILE ================= */
router.get("/profile/:driverId", async (req, res) => {
  try {
    const driver = await findDriver(req.params.driverId);

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    res.json({
      success: true,
      data: driver,
    });
  } catch (error) {
    console.error("Driver profile error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load profile",
    });
  }
});

/* ================= DRIVER TRACKING ================= */
router.get("/tracking/:driverId", async (req, res) => {
  try {
    const driver = await findDriver(req.params.driverId);

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    res.json({
      success: true,
      data: {
        name: driver.name,
        phone: driver.phone,
        vehicleNumber: driver.vehicleNumber,
        location: driver.location,
        lastLocation: driver.lastLocation,
      },
    });
  } catch (error) {
    console.error("Tracking error:", error);
    res.status(500).json({
      success: false,
      message: "Tracking failed",
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
        message: "Driver ID required",
      });
    }

    const driver = await findDriver(driverId);

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    // ❌ REMOVE unwanted fields
    delete updates._id;
    delete updates.__v;
    delete updates.password;

    // ✅ UPDATE ONLY PROVIDED FIELDS
    Object.keys(updates).forEach((key) => {
      if (updates[key] !== undefined) {
        driver[key] = updates[key];
      }
    });

    await driver.save();

    res.json({
      success: true,
      message: "Driver updated successfully",
      data: driver,
    });

  } catch (error) {
    console.error("🔥 UPDATE ERROR:", error); // <-- IMPORTANT
    res.status(500).json({
      success: false,
      message: "Update failed",
      error: error.message, // 👈 helps debugging
    });
  }
});
/* ================= GET DRIVER BY ID ================= */
router.get("/:id", async (req, res) => {
  try {
    const driver = await findDriver(req.params.id);

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "Driver not found",
      });
    }

    res.json({
      success: true,
      data: driver,
    });
  } catch (error) {
    console.error("Get driver error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch driver",
    });
  }
});

export default router;
