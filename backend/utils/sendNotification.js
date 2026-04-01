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
    console.log("🔥 sendNotification CALLED");

    if (!driverId || !title || !message) {
      throw new Error("Missing fields");
    }

    console.log("📢 Saving notification:", { driverId, title });

    // ✅ SAVE TO DB
    const notification = await Notification.create({
      driver: driverId,
      title,
      message,
      read: false
    });

    console.log("✅ Notification SAVED:", notification._id);

    // ✅ SOCKET
    if (io) {
      io.to(driverId).emit("new_notification", notification);
    }

    // ✅ FIREBASE (optional)
    if (fcmToken && admin.apps.length) {
      try {
        await admin.messaging().send({
          notification: {
            title,
            body: message
          },
          token: fcmToken
        });
      } catch (err) {
        console.error("❌ Firebase error:", err.message);
      }
    }

    return notification;

  } catch (error) {
    console.error("❌ sendNotification FAILED:", error);
    throw error; // 🔥 IMPORTANT (DO NOT SILENCE)
  }
};
