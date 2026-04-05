import express from "express";
import Child from "../models/Child.js";
import { sendNotification } from "../utils/sendNotification.js";

const router = express.Router();

/* ================= SAFE NOTIFICATION ================= */
const safeNotify = async (req, payload) => {
  try {
    const io = req.app.get("io");

    if (io) {
      await sendNotification({ ...payload, io });
      console.log("✅ Notification sent");
    } else {
      console.warn("⚠️ IO not available");
    }
  } catch (err) {
    console.error("⚠️ Notification failed:", err.message);
  }
};

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
      status: "waiting",
    });

    res.status(201).json({ success: true, data: child });
  } catch (err) {
    console.error("🔥 Add child error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ================= GET BY DRIVER ================= */
router.get("/driver/:driverId", async (req, res) => {
  try {
    const children = await Child.find({
      driverId: String(req.params.driverId),
    });

    res.json({ success: true, data: children });
  } catch (err) {
    console.error("❌ Driver fetch error:", err);
    res.status(500).json({ success: false });
  }
});

/* ================= PICKUP ================= */
router.post("/pickup", async (req, res) => {
  try {
    const { childId } = req.body;

    const child = await Child.findById(childId);
    if (!child) return res.status(404).json({ message: "Not found" });

    if (child.status !== "waiting") {
      return res.status(400).json({ message: "Already picked" });
    }

    child.status = "onboard";
    await child.save();

    await safeNotify(req, {
      driverId: child.driverId,
      childId: child._id,
      title: "Pickup Update",
      message: `${child.name} picked up`,
      type: "pickup",
      priority: "high",
    });

    res.json({ success: true, data: child });
  } catch (err) {
    console.error("❌ Pickup error:", err);
    res.status(500).json({ message: err.message });
  }
});

/* ================= DROP ================= */
router.post("/drop", async (req, res) => {
  try {
    const { childId } = req.body;

    const child = await Child.findById(childId);
    if (!child) return res.status(404).json({ message: "Not found" });

    if (child.status !== "onboard") {
      return res.status(400).json({ message: "Not onboard" });
    }

    child.status = "dropped";
    await child.save();

    await safeNotify(req, {
      driverId: child.driverId,
      childId: child._id,
      title: "Drop Update",
      message: `${child.name} dropped`,
      type: "drop",
      priority: "high",
    });

    res.json({ success: true, data: child });
  } catch (err) {
    console.error("❌ Drop error:", err);
    res.status(500).json({ message: err.message });
  }
});

/* ================= ABSENT ================= */
router.post("/absent", async (req, res) => {
  try {
    const { childId } = req.body;

    const child = await Child.findById(childId);
    if (!child) return res.status(404).json({ message: "Not found" });

    if (child.status !== "waiting") {
      return res.status(400).json({
        message: "Only waiting students can be absent",
      });
    }

    child.status = "absent";
    child.absentAt = new Date();
    await child.save();

    await safeNotify(req, {
      driverId: child.driverId,
      childId: child._id,
      title: "Absent Update",
      message: `${child.name} marked absent`,
      type: "absent",
      priority: "high",
    });

    res.json({ success: true, data: child });
  } catch (err) {
    console.error("❌ Absent error:", err);
    res.status(500).json({ message: err.message });
  }
});

/* ================= RESET ================= */
router.post("/reset/:driverId", async (req, res) => {
  try {
    await Child.updateMany(
      { driverId: req.params.driverId },
      { status: "waiting" }
    );

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Reset error:", err);
    res.status(500).json({ message: err.message });
  }
});

export default router;
