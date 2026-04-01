import express from "express";
import {
  getNotifications,
  markAsRead
} from "../controllers/notificationController.js";

const router = express.Router();

/* ================= GET NOTIFICATIONS ================= */
/**
 * 🔥 IMPORTANT:
 * Use driverId in query → /api/notifications?driverId=ASAN-XXXX
 */
router.get("/", getNotifications);

/* ================= GET BY DRIVER (USED IN FRONTEND) ================= */
/**
 * 🔥 REQUIRED for your frontend:
 * /api/notifications/:driverId
 */
router.get("/:driverId", getNotifications);


/* ================= MARK AS READ ================= */
router.put("/read-all/:driverId", markAllAsRead);

export default router;
