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

    /* ================= DRIVER ================= */
    if (driverId) {
      await Driver.findByIdAndUpdate(
        driverId,
        {
          $addToSet: { fcmTokens: token }, // ✅ ARRAY SUPPORT
        },
        { new: true }
      );

      console.log("✅ Driver token saved");
    }

    /* ================= PARENT ================= */
    if (parentId) {
      await Parent.findByIdAndUpdate(
        parentId,
        {
          $addToSet: { fcmTokens: token }, // ✅ ARRAY SUPPORT
        },
        { new: true }
      );

      console.log("✅ Parent token saved");
    }

    return res.json({
      success: true,
      message: "Token saved successfully",
    });

  } catch (err) {
    console.error("❌ Save token error:", err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

/* ================= FETCH ================= */

// Driver notifications
router.get("/", getNotifications);

// All notifications
router.get("/all", getAllNotifications);

// Parent-specific notifications
router.get("/parent/:parentId", getParentNotifications);

/* ================= UPDATE ================= */

// mark one as read
router.put("/:id/read", markAsRead);

// mark all as read
router.put("/read-all", markAllAsRead);

export default router;
