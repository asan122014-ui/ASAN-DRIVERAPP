import express from "express";
import {
  getNotifications,
  markAsRead
} from "../controllers/notificationController.js";

const router = express.Router();

/* ================= GET DRIVER NOTIFICATIONS ================= */
router.get("/", getNotifications);

/* ================= MARK AS READ ================= */
router.put("/:id/read", markAsRead);

export default router;
