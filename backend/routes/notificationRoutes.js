import express from "express";
import {
  getNotifications,
  getAllNotifications,
  markAsRead,
  markAllAsRead,
  sendTestNotification,
} from "../controllers/notificationController.js";

const router = express.Router();

/* ================= TEST ================= */
router.post("/test", sendTestNotification);

/* ================= FETCH ================= */
// unread
router.get("/", getNotifications);

// all (with filters: driverId, parentId, childId)
router.get("/all", getAllNotifications);

/* ================= UPDATE ================= */
// mark single
router.put("/:id/read", markAsRead);

// mark all
router.put("/read-all", markAllAsRead);

export default router;
