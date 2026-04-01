import admin from "firebase-admin";
import Notification from "../models/Notification.js";
import Parent from "../models/Parent.js";

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

    /* ================= SAVE TO DB ================= */
    const notification = await Notification.create({
      driver: driverId,
      title,
      message,
      read: false
    });

    console.log("✅ Notification SAVED:", notification._id);

    /* ================= SOCKET ================= */
    if (io) {
      const driverRoom = String(driverId);

      // ✅ SEND TO DRIVER
      io.to(driverRoom).emit("new_notification", notification);

      // 🔥 SEND TO PARENT (FIXED + SAFE)
      const parent = await Parent.findOne({ driverId });

      if (parent && parent._id) {
        const parentRoom = parent._id.toString();

        console.log("📡 Sending to parent:", parentRoom);

        io.to(parentRoom).emit("notification", {
          title,
          message,
          driverId, // 🔥 extra (optional for debugging/UI)
          createdAt: new Date()
        });
      } else {
        console.log("⚠️ No parent linked to driver:", driverId);
      }
    }

    /* ================= FIREBASE ================= */
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
    throw error;
  }
};
