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
      eveningPickup,      // ✅ NEW
      eveningDrop,        // ✅ NEW
      pickupLocation,
      dropoffLocation,
      parentId,
      driverId
    } = req.body;

    // ✅ VALIDATION
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
      eveningPickup,     // ✅ SAVE
      eveningDrop,       // ✅ SAVE
      pickupLocation,
      dropoffLocation,
      parentId,
      driverId,
      status: "waiting",
    });

    res.status(201).json({
      success: true,
      data: child,
    });

  } catch (err) {
    console.error("Add child error:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to add child",
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
    console.error("Fetch parent children error:", err.message);
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
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: children,
    });

  } catch (err) {
    console.error("Fetch driver children error:", err.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch children",
    });
  }
});

/* ================= PICKUP CHILD ================= */
router.put("/:id/pickup", async (req, res) => {
  try {
    const child = await Child.findByIdAndUpdate(
      req.params.id,
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
      data: child,
    });

  } catch (err) {
    console.error("Pickup error:", err.message);
    res.status(500).json({
      success: false,
      message: "Pickup failed",
    });
  }
});

/* ================= DROP CHILD ================= */
router.put("/:id/drop", async (req, res) => {
  try {
    const child = await Child.findByIdAndUpdate(
      req.params.id,
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
      data: child,
    });

  } catch (err) {
    console.error("Drop error:", err.message);
    res.status(500).json({
      success: false,
      message: "Drop failed",
    });
  }
});

/* ================= DELETE CHILD ================= */
router.delete("/:id", async (req, res) => {
  try {
    const deletedChild = await Child.findByIdAndDelete(req.params.id);

    if (!deletedChild) {
      return res.status(404).json({
        success: false,
        message: "Child not found",
      });
    }

    res.json({
      success: true,
      message: "Child deleted successfully",
      data: deletedChild,
    });

  } catch (err) {
    console.error("Delete error:", err.message);
    res.status(500).json({
      success: false,
      message: "Delete failed",
    });
  }
});
/* ================= UPDATE CHILD ================= */
router.put("/:id", async (req, res) => {
  try {
    const updated = await Child.findByIdAndUpdate(
      req.params.id,
      req.body, // ✅ includes new fields automatically
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Child not found",
      });
    }

    res.json({
      success: true,
      data: updated,
    });

  } catch (err) {
    console.error("Update error:", err.message);
    res.status(500).json({
      success: false,
      message: "Update failed",
    });
  }
});

export default router;
