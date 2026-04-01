import express from "express";
import Child from "../models/Child.js";

const router = express.Router();

/* ================= ADD CHILD ================= */
router.post("/add", async (req, res) => {
  try {
    const {
      name,
      age,
      school,
      grade,
      pickupTime,
      dropoffTime,
      eveningPickup,
      eveningDrop,
      pickupLocation,
      dropoffLocation,
      location,
      dropLocationCoords,
      parentId,
      driverId
    } = req.body;

    console.log("BODY:", req.body); // 🔥 debug

    if (!name || !parentId || !driverId) {
      return res.status(400).json({
        success: false,
        message: "Name, parentId, and driverId are required",
      });
    }

    const child = await Child.create({
      name,
      age,
      school,
      grade,
      pickupTime,
      dropoffTime,
      eveningPickup,
      eveningDrop,
      pickupLocation,
      dropoffLocation,

      location: {
        lat: location?.lat || null,
        lng: location?.lng || null,
      },

      dropLocationCoords: {
        lat: dropLocationCoords?.lat || null,
        lng: dropLocationCoords?.lng || null,
      },

      parentId,
      driverId,
      status: "waiting",
    });

    res.status(201).json({
      success: true,
      data: child,
    });

  } catch (err) {
    console.error("🔥 Add child error:", err);

    res.status(500).json({
      success: false,
      message: err.message || "Failed to add child",
    });
  }
});

/* ================= GET BY PARENT ================= */
router.get("/parent/:parentId", async (req, res) => {
  try {
    const children = await Child.find({
      parentId: req.params.parentId,
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: children,
    });

  } catch (err) {
    res.status(500).json({ success: false });
  }
});

/* ================= GET BY DRIVER ================= */
router.get("/driver/:driverId", async (req, res) => {
  try {
    const children = await Child.find({
      driverId: req.params.driverId,
    });

    res.json({
      success: true,
      data: children,
    });

  } catch (err) {
    res.status(500).json({ success: false });
  }
});

export default router;
