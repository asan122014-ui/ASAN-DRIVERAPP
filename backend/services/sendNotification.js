import admin from "firebase-admin";
import Notification from "../models/Notification.js";

/*
 Utility: Send Notification
 - Saves to DB
 - Emits via socket
 - Sends Firebase push
*/

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
      console.warn("Missing notification fields");
      return null;
    }

    /* ================= SAVE TO DATABASE ================= */
    const notification = await Notification.create({
      driver: driverId,
      title,
      message,
      read: false
    });

    /* ================= SOCKET.IO ================= */
    if (io) {
      io.to(driverId.toString()).emit("newNotification", notification);
    }

    /* ================= FIREBASE PUSH ================= */
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
        console.error("Firebase push error:", err.message);
      }
    }

    return notification;

  } catch (error) {
    console.error("Send notification error:", error.message);
    return null;
  }
};
