import Location from "../models/Location.js";

import express from "express";
import verifyToken from "../middleware/auth.js";
import Location from "../models/Location.js";

const router = express.Router();

/* ================= UPDATE DRIVER LOCATION ================= */

router.post("/update", verifyToken, async (req, res) => {

  try {

    const { lat, lng } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude required"
      });
    }

    const location = await Location.create({
      driverId: req.user.id,
      latitude: lat,
      longitude: lng
    });

    /* Emit location to admin dashboard */

    const io = req.app.get("io");

    io.emit("driver_location", {
      driverId: req.user.id,
      lat,
      lng
    });

    res.json({
      success: true,
      location
    });

  } catch (error) {

    console.error("Location update error:", error);

    res.status(500).json({
      success: false,
      message: "Location update failed"
    });

  }

});

export default router;