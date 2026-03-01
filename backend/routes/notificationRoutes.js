import express from "express";
import Notification from "../models/Notification.js";
import verifyToken from "../middleware/auth.js";

const router = express.Router();

// 🔔 Get all notifications
router.get("/", verifyToken, async (req, res) => {
  try {
    const notifications = await Notification.find({
      driver: req.user.id,
    }).sort({ createdAt: -1 });

    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});

// 🔔 Mark as read
router.put("/:id/read", verifyToken, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        driver: req.user.id, // 🔐 security check
      },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.json({ message: "Marked as read" });
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
  }
});

export default router;