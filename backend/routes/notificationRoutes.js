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
 */
router.get("/", getNotifications);

/* ================= GET ALL HISTORY ================= */
/**
 * GET /api/notifications/all/:driverId
 */
router.get("/all/:driverId", getAllNotifications);

/* ================= MARK SINGLE AS READ ================= */
/**
 * PUT /api/notifications/:id/read
 */
router.put("/:id/read", markAsRead);

/* ================= MARK ALL AS READ ================= */
/**
 * PUT /api/notifications/read-all/:driverId
 */
router.put("/read-all/:driverId", markAllAsRead);

export default router;
