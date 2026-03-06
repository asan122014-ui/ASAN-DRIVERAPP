import express from "express";
import verifyToken from "../middleware/auth.js";

import {
  getNotifications,
  markAsRead
} from "../controllers/notificationController.js";

const router = express.Router();

/* ================= GET DRIVER NOTIFICATIONS ================= */

router.get("/", verifyToken, getNotifications);

/* ================= MARK NOTIFICATION AS READ ================= */

router.put("/:id/read", verifyToken, markAsRead);

export default router;
