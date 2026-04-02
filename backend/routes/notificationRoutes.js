import express from "express";
import {
  getNotifications,        // unread
  getAllNotifications,     // all
  markAsRead,
  markAllAsRead,
  sendTestNotification
} from "../controllers/notificationController.js";

const router = express.Router();

/* ================= TEST FCM ================= */
/**
 * POST /api/notifications/test
 * Body: { driverId }
 */
router.post("/test", sendTestNotification);

/* ================= GET UNREAD ================= */
/**
 * GET /api/notifications?driverId=XXX OR parentId=XXX
 */
router.get("/", getNotifications);

/* ================= GET ALL ================= */
/**
 * GET /api/notifications/all?driverId=XXX OR parentId=XXX
 */
router.get("/all", getAllNotifications);

/* ================= MARK SINGLE ================= */
/**
 * PUT /api/notifications/:id/read
 */
router.put("/:id/read", markAsRead);

/* ================= MARK ALL ================= */
/**
 * PUT /api/notifications/read-all?driverId=XXX OR parentId=XXX
 */
router.put("/read-all", markAllAsRead);

export default router;
