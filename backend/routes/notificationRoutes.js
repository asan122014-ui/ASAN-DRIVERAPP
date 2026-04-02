import express from "express";
import {
  getNotifications,
  getAllNotifications,
  getParentNotifications, // 🔥 NEW
  markAsRead,
  markAllAsRead,
  sendTestNotification,
} from "../controllers/notificationController.js";

const router = express.Router();

/* ================= TEST ================= */
router.post("/test", sendTestNotification);

/* ================= FETCH ================= */

// 🔥 DRIVER (unread or basic)
router.get("/", getNotifications);

// 🔥 ALL (with filters: driverId, parentId, childId)
router.get("/all", getAllNotifications);

// 🔥 NEW: PARENT-SPECIFIC (MAIN API YOU SHOULD USE)
router.get("/parent/:parentId", getParentNotifications);


/* ================= UPDATE ================= */

// mark single
router.put("/:id/read", markAsRead);

// 🔥 mark all (based on parentId or driverId)
router.put("/read-all", markAllAsRead);


export default router;
