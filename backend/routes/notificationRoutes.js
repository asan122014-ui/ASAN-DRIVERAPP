import express from "express";
import {
  getNotifications,
  getAllNotifications,
  markAsRead,
  markAllAsRead
} from "../controllers/notificationController.js";

const router = express.Router();

/* ================= SUPPORT QUERY (FIX 404 ERROR) ================= */
/**
 * GET /api/notifications?driverId=ASAN-XXXX
 */
router.get("/", getNotifications);

/* ================= GET ALL (FULL HISTORY) ================= */
/**
 * GET /api/notifications/all/:driverId
 */
router.get("/all/:driverId", getAllNotifications);

/* ================= GET UNREAD (BADGE) ================= */
/**
 * GET /api/notifications/:driverId
 */
router.get("/:driverId", getNotifications);

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
