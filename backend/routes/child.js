import express from "express";
import Child from "../models/Child.js";
import { sendNotification } from "../utils/sendNotification.js"; // ✅ ADD THIS

const router = express.Router();

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

    const child = await Child.findById(childId);

    if (!child) {
      return res.status(404).json({
        success: false,
        message: "Child not found",
      });
    }

    if (child.status !== "waiting") {
      return res.status(400).json({
        success: false,
        message: "Student already picked or completed",
      });
    }

    child.status = "onboard";
    await child.save();

    /* 🔥 SEND NOTIFICATION */
    const io = req.app.get("io");

    await sendNotification({
      driverId: child.driverId,
      childId: child._id,
      title: "Pickup Update",
      message: `${child.name} has been picked up`,
      type: "pickup",
      priority: "high",
      io,
    });

    console.log("✅ PICKUP NOTIFICATION SENT");

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

    const child = await Child.findById(childId);

    if (!child) {
      return res.status(404).json({
        success: false,
        message: "Child not found",
      });
    }

    if (child.status !== "onboard") {
      return res.status(400).json({
        success: false,
        message: "Student not onboard",
      });
    }

    child.status = "dropped";
    await child.save();

    /* 🔥 SEND NOTIFICATION */
    const io = req.app.get("io");

    await sendNotification({
      driverId: child.driverId,
      childId: child._id,
      title: "Drop Update",
      message: `${child.name} has been dropped safely`,
      type: "drop",
      priority: "high",
      io,
    });

    console.log("✅ DROP NOTIFICATION SENT");

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
