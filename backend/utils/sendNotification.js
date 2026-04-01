// utils/sendNotification.js

import admin from "firebase-admin";
import Notification from "../models/Notification.js";

export const sendNotification = async ({
  driverId,
  title,
  message,
  fcmToken,
  io
}) => {
  try {
    /* ===== VALIDATION ===== */
    if (!driverId || !title || !message) {
      console.warn("❌ Missing notification fields");
      return null;
    }

    console.log("📢 Creating notification for:", driverId);

    /* ===== SAVE TO DB ===== */
    const notification = await Notification.create({
      driver: driverId, // 🔥 MUST MATCH frontend
      title,
      message,
      read: false
    });

    /* ===== SOCKET ===== */
    if (io) {
      io.to(driverId).emit("new_notification", notification); // 🔥 FIXED NAME
    }

    /* ===== FIREBASE (OPTIONAL) ===== */
    if (fcmToken && admin.apps.length) {
      try {
        await admin.messaging().send({
          notification: { title, body: message },
          token: fcmToken
        });
      } catch (err) {
        console.error("Firebase error:", err.message);
      }
    }

    return notification;

  } catch (error) {
    console.error("❌ Send notification error:", error.message);
    return null;
  }
};
