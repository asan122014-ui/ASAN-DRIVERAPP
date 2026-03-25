import express from "express";
import Location from "../models/Location.js";

const router = express.Router();

/* ================= UPDATE DRIVER LOCATION ================= */
router.post("/update", async (req, res) => {
  try {
    const { driverId, lat, lng } = req.body;

    if (!driverId || !lat || !lng) {
      return res.status(400).json({
        success: false,
        message: "DriverId, latitude and longitude required"
      });
    }

    const location = await Location.create({
      driver: driverId,
      location: {
        type: "Point",
        coordinates: [lng, lat]
      }
    });

    /* Emit location to admin dashboard */
    const io = req.app.get("io");
    if (io) {
      io.emit("driver_location", {
        driverId,
        lat,
        lng
      });
    }

    res.json({
      success: true,
      location
    });

  } catch (error) {
    console.error("Location update error:", error.message);

    res.status(500).json({
      success: false,
      message: "Location update failed"
    });
  }
});

export default router;
