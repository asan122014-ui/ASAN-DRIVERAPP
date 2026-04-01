import express from "express";
import {
  getNotifications,
  getAllNotifications,
  markAsRead,
  markAllAsRead
} from "../controllers/notificationController.js";

const router = express.Router();

/* GET UNREAD */
router.get("/", getNotifications);

/* GET ALL */
router.get("/all", getAllNotifications);

/* MARK ONE */
router.put("/:id/read", markAsRead);

/* MARK ALL */
router.put("/read-all", markAllAsRead);

export default router;
