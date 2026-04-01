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
      driverId,
    } = req.body;

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

      // ✅ SAFE LOCATION
      location: {
        lat: location?.lat ?? null,
        lng: location?.lng ?? null,
      },

      dropLocationCoords: {
        lat: dropLocationCoords?.lat ?? null,
        lng: dropLocationCoords?.lng ?? null,
      },

      parentId,
      driverId,

      // ✅ DEFAULT STATUS
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
    console.error("Parent fetch error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch children",
    });
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
    console.error("Driver fetch error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch children",
    });
  }
});

/* ================= PICKUP STUDENT ================= */
router.post("/pickup", async (req, res) => {
  try {
    const { childId } = req.body;

    if (!childId) {
      return res.status(400).json({
        success: false,
        message: "Child ID is required",
      });
    }

    const child = await Child.findByIdAndUpdate(
      childId,
      { status: "onboard" },
      { new: true }
    );

    if (!child) {
      return res.status(404).json({
        success: false,
        message: "Child not found",
      });
    }

    res.json({
      success: true,
      message: "Student picked up",
      data: child,
    });

  } catch (err) {
    console.error("Pickup error:", err);
    res.status(500).json({
      success: false,
      message: "Pickup failed",
    });
  }
});

/* ================= DROP STUDENT ================= */
router.post("/drop", async (req, res) => {
  try {
    const { childId } = req.body;

    if (!childId) {
      return res.status(400).json({
        success: false,
        message: "Child ID is required",
      });
    }

    const child = await Child.findByIdAndUpdate(
      childId,
      { status: "dropped" },
      { new: true }
    );

    if (!child) {
      return res.status(404).json({
        success: false,
        message: "Child not found",
      });
    }

    res.json({
      success: true,
      message: "Student dropped",
      data: child,
    });

  } catch (err) {
    console.error("Drop error:", err);
    res.status(500).json({
      success: false,
      message: "Drop failed",
    });
  }
});

export default router;
