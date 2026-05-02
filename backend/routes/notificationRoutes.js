import express from "express";
import Driver from "../models/Driver.js";
import Parent from "../models/Parent.js";

import {
  getNotifications,
  getAllNotifications,
  getParentNotifications,
  markAsRead,
  markAllAsRead,
  sendTestNotification,
} from "../controllers/notificationController.js";

const router = express.Router();

/* ================= TEST ================= */
router.post("/test", sendTestNotification);

/* ================= SAVE FCM TOKEN ================= */
router.post("/save-token", async (req, res) => {
  try {
    const { driverId, parentId, token } = req.body;

    console.log("🔥 TOKEN RECEIVED:", req.body);

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Token is required",
      });
    }

    // ✅ Save for Driver
    if (driverId) {
      await Driver.findByIdAndUpdate(driverId, {
        fcmToken: token,
      });
      console.log("✅ Driver token saved");
    }

    // ✅ Save for Parent
    if (parentId) {
      await Parent.findByIdAndUpdate(parentId, {
        fcmToken: token,
      });
      console.log("✅ Parent token saved");
    }

    res.json({
      success: true,
      message: "Token saved successfully",
    });

  } catch (err) {
    console.error("❌ Save token error:", err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

/* ================= FETCH ================= */

// DRIVER notifications
router.get("/", getNotifications);

// ALL notifications
router.get("/all", getAllNotifications);

// 🔥 Parent-specific notifications
router.get("/parent/:parentId", getParentNotifications);

/* ================= UPDATE ================= */

// mark single
router.put("/:id/read", markAsRead);

// mark all
router.put("/read-all", markAllAsRead);

export default router;
