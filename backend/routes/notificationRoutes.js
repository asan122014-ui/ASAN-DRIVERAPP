import express from "express";
import {
  getNotifications,
  getAllNotifications,
  markAsRead,
  markAllAsRead
} from "../controllers/notificationController.js";

const router = express.Router();

/* ================= GET UNREAD (FOR BADGE) ================= */
/**
 * GET /api/notifications/:driverId
 * Returns ONLY unread notifications
 */
router.get("/:driverId", getNotifications);

/* ================= GET ALL (FOR SCREEN) ================= */
/**
 * GET /api/notifications/all/:driverId
 * Returns full history
 */
router.get("/all/:driverId", getAllNotifications);

/* ================= MARK SINGLE ================= */
/**
 * PUT /api/notifications/:id/read
 */
router.put("/:id/read", markAsRead);

/* ================= MARK ALL ================= */
/**
 * PUT /api/notifications/read-all/:driverId
 */
router.put("/read-all/:driverId", markAllAsRead);

export default router;
