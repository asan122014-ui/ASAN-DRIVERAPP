import express from "express";
import {
  getNotifications,
  getAllNotifications,
  markAsRead,
  markAllAsRead
} from "../controllers/notificationController.js";

const router = express.Router();

/* ================= GET NOTIFICATIONS ================= */
/**
 * GET /api/notifications?driverId=XXX OR parentId=XXX
 * 👉 returns latest notifications (with unread first)
 */
router.get("/", getNotifications);

/* ================= GET FULL HISTORY ================= */
/**
 * GET /api/notifications/all?driverId=XXX OR parentId=XXX
 * 👉 returns full notification history
 */
router.get("/all/:driverId", getAllNotifications);

/* ================= MARK SINGLE AS READ ================= */
/**
 * PUT /api/notifications/:id/read
 */
router.put("/:id/read", markAsRead);

/* ================= MARK ALL AS READ ================= */
/**
 * PUT /api/notifications/read-all?driverId=XXX OR parentId=XXX
 */
router.put("/read-all", markAllAsRead);

export default router;
