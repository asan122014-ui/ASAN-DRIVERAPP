import Notification from "../models/Notification.js";
import Driver from "../models/Driver.js";
import admin from "firebase-admin";

/* ================= GET DRIVER NOTIFICATIONS ================= */

export const getNotifications = async (req, res) => {
  try {

    const notifications = await Notification.find({
      driver: req.user.id
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      data: notifications
    });

  } catch (error) {

    console.error("Notification fetch error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch notifications"
    });

  }
};


/* ================= MARK AS READ ================= */

export const markAsRead = async (req, res) => {
  try {

    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        driver: req.user.id
      },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found"
      });
    }

    res.json({
      success: true,
      message: "Notification marked as read"
    });

  } catch (error) {

    console.error("Notification update error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update notification"
    });

  }
};


/* ================= CREATE NOTIFICATION ================= */

export const createNotification = async (
  driverId,
  title,
  message,
  io
) => {

  try {

    const notification = await Notification.create({
      driver: driverId,
      title,
      message,
      read: false
    });

    /* ================= SOCKET REALTIME ================= */

    if (io) {
      io.to(driverId).emit("newNotification", notification);
    }

    /* ================= FIREBASE PUSH ================= */

    const driver = await Driver.findById(driverId);

    if (driver?.fcmToken) {

      const payload = {
        notification: {
          title: title,
          body: message
        },
        token: driver.fcmToken
      };

      await admin.messaging().send(payload);
    }

    return notification;

  } catch (error) {

    console.error("Create notification error:", error);

  }

};